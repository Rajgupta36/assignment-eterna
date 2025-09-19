use axum::{
    extract::{ws::WebSocketUpgrade, State},
    http::StatusCode,
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
    dotenvy::dotenv().ok();
    
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let server_port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "3000".to_string());
    
    let redis_client = Client::open(redis_url.clone()).unwrap();
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

    let bind_address = format!("0.0.0.0:{}", server_port);
    let listener = tokio::net::TcpListener::bind(&bind_address).await.unwrap();
    println!("Server running on http://{}", bind_address);
    
    axum::serve(listener, app).await.unwrap();
}

async fn handle_order_execution(
    State(_connections): State<WebSocketConnections>,
    Json(payload): Json<OrderRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let order_id = uuid::Uuid::new_v4().to_string();

    let max_slippage_decimal = payload.max_slippage.unwrap_or(0.05);
    if !is_valid_slippage(max_slippage_decimal) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let order_data = create_order_data(&order_id, &payload, max_slippage_decimal);
    publish_order_to_redis(&redis_url, &order_data).await;

    Ok(Json(serde_json::json!({
        "order_id": order_id,
    })))
}

async fn handle_websocket_upgrade(
    ws: WebSocketUpgrade,
    State(connections): State<WebSocketConnections>,
) -> Response {
    ws.on_upgrade(|socket| async move {
        let (sender, mut receiver) = socket.split();
        
        if let Some(msg) = receiver.next().await {
            if let Ok(axum::extract::ws::Message::Text(text)) = msg {
                let order_id = text.trim();
                register_websocket_connection(&connections, order_id, sender).await;
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
                    process_status_update(&connections, &message).await;
                }
            }
        }
    }
}

fn is_valid_slippage(slippage: f64) -> bool {
    slippage > 0.01 && slippage < 0.5
}

fn create_order_data(order_id: &str, payload: &OrderRequest, max_slippage: f64) -> serde_json::Value {
    serde_json::json!({
        "order_id": order_id,
        "token_in": payload.token_in,
        "token_out": payload.token_out,
        "amount": payload.amount,
        "order_type": payload.order_type,
        "max_slippage": max_slippage * 100.0
    })
}

async fn publish_order_to_redis(redis_url: &str, order_data: &serde_json::Value) {
    let redis_client = Client::open(redis_url).unwrap();
    let mut conn = redis_client.get_async_connection().await.unwrap();
    let _: String = conn.xadd("order_stream", "*", &[("order_data", order_data.to_string().as_str())]).await.unwrap();
}

async fn register_websocket_connection(
    connections: &WebSocketConnections, 
    order_id: &str, 
    sender: futures_util::stream::SplitSink<axum::extract::ws::WebSocket, axum::extract::ws::Message>
) {
    let mut conns = connections.write().await;
    conns.insert(order_id.to_string(), sender);
}

async fn process_status_update(connections: &WebSocketConnections, message: &redis::streams::StreamId) {
    let status_json_value = message.map.get("status_data");
    if status_json_value.is_none() { return; }
    
    let status_json_str = match from_redis_value::<String>(status_json_value.unwrap()) {
        Ok(s) => s,
        Err(_) => return,
    };
    
    let status_update = match serde_json::from_str::<serde_json::Value>(&status_json_str) {
        Ok(v) => v,
        Err(_) => return,
    };
    
    let order_id = match status_update.get("order_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return,
    };
    
    send_to_websocket(connections, order_id, &status_json_str).await;
    cleanup_if_final_status(connections, order_id, &status_update).await;
}

async fn send_to_websocket(connections: &WebSocketConnections, order_id: &str, status_json_str: &str) {
    let mut conns = connections.write().await;
    if let Some(sender) = conns.get_mut(order_id) {
        let _ = sender.send(axum::extract::ws::Message::Text(status_json_str.to_string())).await;
    }
}

async fn cleanup_if_final_status(connections: &WebSocketConnections, order_id: &str, status_update: &serde_json::Value) {
    if let Some(status) = status_update.get("status").and_then(|v| v.as_str()) {
        if status == "confirmed" || status == "failed" {
            let mut conns = connections.write().await;
            conns.remove(order_id);
        }
    }
}