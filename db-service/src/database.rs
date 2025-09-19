use tokio_postgres::{NoTls, Client};
use std::env;

pub async fn create_connection() -> Result<Client, Box<dyn std::error::Error + Send + Sync>> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/order_db".to_string());
    
    let (client, connection) = tokio_postgres::connect(&database_url, NoTls).await?;
    
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("Database connection error: {}", e);
        }
    });
    
    Ok(client)
}
