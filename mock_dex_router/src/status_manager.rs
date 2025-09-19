use tokio::sync::mpsc;
use std::sync::Arc;
use crate::types::StatusUpdate;
use crate::redis_handler::RedisHandler;

pub struct StatusManager {
    status_tx: Arc<mpsc::Sender<StatusUpdate>>,
}

impl StatusManager {
    pub fn new() -> (Self, mpsc::Receiver<StatusUpdate>) {
        let (status_tx, status_rx) = mpsc::channel::<StatusUpdate>(1000);
        let status_tx = Arc::new(status_tx);
        
        let manager = StatusManager { status_tx };
        (manager, status_rx)
    }

    pub fn get_sender(&self) -> Arc<mpsc::Sender<StatusUpdate>> {
        self.status_tx.clone()
    }

    pub async fn start_redis_writer(
        redis_handler: RedisHandler,
        mut status_rx: mpsc::Receiver<StatusUpdate>,
    ) {
        let mut writer_conn = match redis_handler.get_connection().await {
            Ok(conn) => conn,
            Err(e) => {
                println!("redis writer conn failed: {}", e);
                return;
            }
        };
        
        println!("redis writer started");
        
        while let Some(status_update) = status_rx.recv().await {
            if let Err(e) = RedisHandler::write_status_to_redis(&mut writer_conn, &status_update).await {
                println!("redis write failed: {}", e);
            }
        }
    }
}
