use redis::{Client, AsyncCommands};
use crate::types::StatusUpdate;

#[derive(Clone)]
pub struct RedisHandler {
    client: Client,
}

impl RedisHandler {
    pub fn new(redis_url: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let client = Client::open(redis_url)?;
        Ok(RedisHandler { client })
    }

    pub async fn get_connection(&self) -> Result<redis::aio::Connection, Box<dyn std::error::Error + Send + Sync>> {
        Ok(self.client.get_async_connection().await?)
    }

    pub async fn read_order_stream(
        &self,
        conn: &mut redis::aio::Connection,
        last_id: &str,
    ) -> Result<redis::Value, Box<dyn std::error::Error + Send + Sync>> {
        let result: Result<redis::Value, _> = conn
            .xread_options(
                &["order_stream"], 
                &[last_id], 
                &redis::streams::StreamReadOptions::default().block(0)
            )
            .await;
        
        match result {
            Ok(value) => Ok(value),
            Err(e) => Err(Box::new(e)),
        }
    }

    pub async fn write_status_to_redis(
        conn: &mut redis::aio::Connection,
        status_update: &StatusUpdate,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let status_data = status_update.to_redis_data();
        
        let _: String = conn
            .xadd("status_updates", "*", &[("status_data", status_data.to_string().as_str())])
            .await?;
        
        Ok(())
    }
}
