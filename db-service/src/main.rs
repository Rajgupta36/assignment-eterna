mod models;
mod database;
mod redis_monitor;
mod schema;

use redis_monitor::RedisMonitor;
use std::env;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use diesel::Connection;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    dotenvy::dotenv().ok();
    
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/order_db".to_string());
    
    let mut conn = diesel::PgConnection::establish(&database_url)?;
    conn.run_pending_migrations(MIGRATIONS)?;
    
    let redis_monitor = RedisMonitor::new(&redis_url).await?;
    redis_monitor.start_monitoring().await?;
    
    Ok(())
}
