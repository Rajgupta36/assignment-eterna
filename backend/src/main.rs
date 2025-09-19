use axum::{
    extract::ws::WebSocketUpgrade,
    http::StatusCode,
    response::Response,
    routing::{get, post},
    Json, Router,
};
use crate::models::OrderRequest;
use tower_http::cors::CorsLayer;
use futures_util::{sink::SinkExt, stream::StreamExt};

mod models;

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/orders/execute", post(handle_order_execution))
        .route("/api/orders/execute", get(handle_websocket_upgrade))
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Server running on http://0.0.0.0:3000");
    
    axum::serve(listener, app).await.unwrap();
}

async fn handle_order_execution(
    ws: WebSocketUpgrade,
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
    })
}

async fn handle_websocket_upgrade(
    ws: WebSocketUpgrade,
) -> Response {
    ws.on_upgrade(|socket| async move {
        let (mut sender, mut receiver) = socket.split();
        
        if let Some(msg) = receiver.next().await {
            if let Ok(axum::extract::ws::Message::Text(_text)) = msg {
                let order_id = uuid::Uuid::new_v4().to_string();
                let pending_update = serde_json::json!({
                    "order_id": order_id,
                    "status": "pending"
                });
                
                let _ = sender.send(axum::extract::ws::Message::Text(pending_update.to_string())).await;
            }
        }
    })
}
