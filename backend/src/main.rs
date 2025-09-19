use axum::{
    extract::{ws::WebSocketUpgrade, State},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use crate::models::OrderRequest;
use tower_http::cors::CorsLayer;
use futures_util::{sink::SinkExt, stream::StreamExt};
use redis::{Client, AsyncCommands, from_redis_value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

mod models;

type WebSocketConnections = Arc<RwLock<HashMap<String, futures_util::stream::SplitSink<axum::extract::ws::WebSocket, axum::extract::ws::Message>>>>;

#[tokio::main]
async fn main() {
    let redis_client = Client::open("redis://127.0.0.1:6379").unwrap();
    let connections: WebSocketConnections = Arc::new(RwLock::new(HashMap::new()));
    
    let connections_clone = connections.clone();
    tokio::spawn(async move {
        listen_to_redis_updates(redis_client, connections_clone).await;
    });

    let app = Router::new()
        .route("/api/orders/execute", post(handle_order_execution))
        .route("/api/orders/execute", get(handle_websocket_upgrade))
        .with_state(connections)
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Server running on http://0.0.0.0:3000");
    
    axum::serve(listener, app).await.unwrap();
}

async fn handle_order_execution(
    ws: WebSocketUpgrade,
    State(connections): State<WebSocketConnections>,
    Json(payload): Json<OrderRequest>,
) -> Response {
    let order_id = uuid::Uuid::new_v4().to_string();

    ws.on_upgrade(move |socket| async move {
        let (mut sender, _receiver) = socket.split();
        
        let pending_update = serde_json::json!({
            "order_id": order_id,
            "status": "pending"
        });
        
        let _ = sender.send(axum::extract::ws::Message::Text(pending_update.to_string())).await;
        
        {
            let mut conns = connections.write().await;
            conns.insert(order_id.clone(), sender);
        }
        
        let redis_client = Client::open("redis://127.0.0.1:6379").unwrap();
        let mut conn = redis_client.get_async_connection().await.unwrap();
        
        let order_data = serde_json::json!({
            "order_id": order_id,
            "token_in": payload.token_in,
            "token_out": payload.token_out,
            "amount": payload.amount,
            "order_type": payload.order_type
        });
        
        let _: String = conn.xadd("order_stream", "*", &[("order_data", order_data.to_string().as_str())]).await.unwrap();
    })
}

async fn handle_websocket_upgrade(
    ws: WebSocketUpgrade,
    State(connections): State<WebSocketConnections>,
) -> Response {
    ws.on_upgrade(|socket| async move {
        let (mut sender, mut receiver) = socket.split();
        
        if let Some(msg) = receiver.next().await {
            if let Ok(axum::extract::ws::Message::Text(text)) = msg {
                if let Ok(payload) = serde_json::from_str::<OrderRequest>(&text) {
                    let order_id = uuid::Uuid::new_v4().to_string();
                    
                    let pending_update = serde_json::json!({
                        "order_id": order_id,
                        "status": "pending"
                    });
                    
                    let _ = sender.send(axum::extract::ws::Message::Text(pending_update.to_string())).await;
                    
                    {
                        let mut conns = connections.write().await;
                        conns.insert(order_id.clone(), sender);
                    }
                    
                    let redis_client = Client::open("redis://127.0.0.1:6379").unwrap();
                    let mut conn = redis_client.get_async_connection().await.unwrap();
                    
                    let order_data = serde_json::json!({
                        "order_id": order_id,
                        "token_in": payload.token_in,
                        "token_out": payload.token_out,
                        "amount": payload.amount,
                        "order_type": payload.order_type
                    });
                    
                    let _: String = conn.xadd("order_stream", "*", &[("order_data", order_data.to_string().as_str())]).await.unwrap();
                }
            }
        }
    })
}

async fn listen_to_redis_updates(redis_client: Client, connections: WebSocketConnections) {
    let mut conn = redis_client.get_async_connection().await.unwrap();
    let mut latest_msg_id = "$".to_string();
    
    loop {
        let result: Result<redis::streams::StreamReadReply, _> = conn
            .xread_options(&["status_updates"], &[&latest_msg_id], &redis::streams::StreamReadOptions::default().block(0))
            .await;
        
        if let Ok(reply) = result {
            for stream in reply.keys {
                for message in stream.ids {
                    latest_msg_id = message.id.clone();
                    
                    if let Some(status_json_value) = message.map.get("status_data") {
                        if let Ok(status_json_str) = from_redis_value::<String>(status_json_value) {
                            if let Ok(status_update) = serde_json::from_str::<serde_json::Value>(&status_json_str) {
                                if let Some(order_id) = status_update.get("order_id").and_then(|v| v.as_str()) {
                                    let mut conns = connections.write().await;
                                    if let Some(sender) = conns.get_mut(order_id) {
                                        let _ = sender.send(axum::extract::ws::Message::Text(status_json_str.clone())).await;
                                        
                                        if let Some(status) = status_update.get("status").and_then(|v| v.as_str()) {
                                            if status == "confirmed" || status == "failed" {
                                                conns.remove(order_id);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}