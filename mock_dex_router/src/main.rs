mod models;
mod dex_router;
mod types;
mod redis_handler;
mod status_manager;
mod processor;
mod parser;

use dex_router::MockDexRouter;
use redis_handler::RedisHandler;
use status_manager::StatusManager;
use processor::OrderProcessor;
use parser::StreamParser;
use std::sync::Arc;
use tokio::sync::Semaphore;

#[tokio::main]
async fn main() {
    println!("Mock DEX Router starting...");
    println!("Connecting to Redis...");
    
    let redis_handler = match RedisHandler::new("redis://127.0.0.1:6379") {
        Ok(handler) => handler,
        Err(e) => {
            eprintln!("Failed to create Redis handler: {}", e);
            return;
        }
    };
    
    let mut conn = match redis_handler.get_connection().await {
        Ok(conn) => conn,
        Err(e) => {
            eprintln!("Failed to connect to Redis: {}", e);
            return;
        }
    };
    
    let router = Arc::new(MockDexRouter::new());
    let semaphore = Arc::new(Semaphore::new(10));
    
    let (status_manager, status_rx) = StatusManager::new();
    let status_tx = status_manager.get_sender();
    
    let redis_handler_clone = redis_handler.clone();
    tokio::spawn(async move {
        StatusManager::start_redis_writer(redis_handler_clone, status_rx).await;
    });
    
    println!("connected to redis");
    
    let mut last_id = "$".to_string();
    
    loop {
        let result = redis_handler.read_order_stream(&mut conn, &last_id).await;
        
        match result {
            Ok(redis_value) => {
                match StreamParser::parse_redis_stream_response(redis_value) {
                    Ok(messages) => {
                        if messages.is_empty() {
                            println!("waiting...");
                            continue;
                        }
                        
                        for message in messages {
                            println!("msg: {}", message.message_id);
                            println!("queue: {}", message.order_id);
                            println!("   {} {} -> {}", message.amount, message.token_in, message.token_out);
                            
                            last_id = message.message_id.clone();
                            
                            OrderProcessor::spawn_order_task(
                                router.clone(),
                                semaphore.clone(),
                                status_tx.clone(),
                                message.order_id,
                                message.token_in,
                                message.token_out,
                                message.amount,
                                message.max_slippage,
                            ).await;
                        }
                    }
                    Err(e) => {
                        println!("parse error: {}", e);
                    }
                }
            }
            Err(e) => {
                println!("redis err: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
            }
        }
    }
}