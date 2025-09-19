use redis::{Client, AsyncCommands, from_redis_value};
use serde_json;
use crate::models::{StatusUpdate, NewOrder};
use crate::database::create_connection;
use tokio_postgres::Client as PgClient;
use std::time::Duration;
use tokio::time::sleep;

pub struct RedisMonitor {
    redis_client: Client,
    pg_client: PgClient,
}

impl RedisMonitor {
    pub async fn new(redis_url: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let redis_client = Client::open(redis_url)?;
        let pg_client = create_connection().await?;
        Ok(RedisMonitor {
            redis_client,
            pg_client,
        })
    }

    pub async fn start_monitoring(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.redis_client.get_async_connection().await?;
        let mut latest_msg_id = "0".to_string();
        
       loop {
            let result: Result<redis::streams::StreamReadReply, _> = conn
                .xread_options(
                    &["status_updates"], 
                    &[&latest_msg_id], 
                    &redis::streams::StreamReadOptions::default().block(1000)
                )
                .await;
            
            match result {
                Ok(reply) => {
                    for stream in reply.keys {
                        for message in stream.ids {
                            latest_msg_id = message.id.clone();
                            self.process_message(&message).await;
                        }
                    }
                }
                Err(_) => {
                    sleep(Duration::from_millis(1000)).await;
                }
            }
        }
    }

    async fn process_message(&self, message: &redis::streams::StreamId) {
        let status_json_value = match message.map.get("status_data") {
            Some(value) => value,
            None => return,
        };

        let status_json_str = match from_redis_value::<String>(status_json_value) {
            Ok(str) => str,
            Err(_) => return,
        };

        let status_update = match serde_json::from_str::<StatusUpdate>(&status_json_str) {
            Ok(update) => update,
            Err(_) => return,
        };

        if status_update.status == "confirmed" || status_update.status == "failed" {
            let _ = self.store_new_order(&status_update).await;
        }
    }

    async fn store_new_order(&self, status_update: &StatusUpdate) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let new_order = NewOrder::from(status_update.clone());
        
        let check_query = "SELECT COUNT(*) FROM orders WHERE order_id = $1";
        let count: i64 = self.pg_client
            .query_one(check_query, &[&status_update.order_id])
            .await?
            .get(0);
        
        if count > 0 {
            return Ok(());
        }
        
        if let Some(price) = new_order.execution_price {
            let price_str = price.to_string();
            let query = format!(
                r#"
                    INSERT INTO orders (order_id, status, tx_hash, reason, execution_price, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, {}::numeric, NOW(), NOW())
                "#,
                price_str
            );
            self.pg_client
                .execute(
                    &query,
                    &[
                        &status_update.order_id,
                        &status_update.status,
                        &status_update.tx_hash,
                        &status_update.reason,
                    ],
                )
                .await?;
        } else {
            self.pg_client
                .execute(
                    r#"
                        INSERT INTO orders (order_id, status, tx_hash, reason, execution_price, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, NULL, NOW(), NOW())
                    "#,
                    &[
                        &status_update.order_id,
                        &status_update.status,
                        &status_update.tx_hash,
                        &status_update.reason,
                    ],
                )
                .await?;
        }
        
        Ok(())
    }
}
