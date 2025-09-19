use tokio::sync::mpsc;
use std::sync::Arc;
use crate::dex_router::MockDexRouter;
use crate::types::StatusUpdate;

pub struct OrderProcessor;

impl OrderProcessor {
    pub async fn process_order_with_channel(
        router: &MockDexRouter,
        status_tx: &mpsc::Sender<StatusUpdate>,
        order_id: &str,
        _token_in: &str,
        _token_out: &str,
        amount: f64,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        
        let status_update = StatusUpdate {
            order_id: order_id.to_string(),
            status: "routing".to_string(),
            tx_hash: None,
            reason: None,
        };
        status_tx.send(status_update).await?;
        println!("   routing...");
        
        let raydium_price = router.get_raydium_quote(amount as u64).await;
        let meteora_price = router.get_meteora_quote(amount as u64).await;
        
        println!("   ray: {:.4}", raydium_price);
        println!("   met: {:.4}", meteora_price);
        
        let (best_dex, best_price) = if raydium_price > meteora_price {
            ("raydium", raydium_price)
        } else {
            ("meteora", meteora_price)
        };
        
        println!("   best: {} {:.4}", best_dex, best_price);
        
        let status_update = StatusUpdate {
            order_id: order_id.to_string(),
            status: "building".to_string(),
            tx_hash: None,
            reason: None,
        };
        status_tx.send(status_update).await?;
        println!("   building...");
        
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        
        let success = rand::random::<f32>() > 0.2;
        
        if success {
            let tx_hash = format!("0x{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
            let status_update = StatusUpdate {
                order_id: order_id.to_string(),
                status: "confirmed".to_string(),
                tx_hash: Some(tx_hash.clone()),
                reason: None,
            };
            status_tx.send(status_update).await?;
            println!("   ok");
            println!("   tx: {}", tx_hash);
        } else {
            let reason = "Simulated execution failure";
            let status_update = StatusUpdate {
                order_id: order_id.to_string(),
                status: "failed".to_string(),
                tx_hash: None,
                reason: Some(reason.to_string()),
            };
            status_tx.send(status_update).await?;
            println!("   fail");
            println!("   why: {}", reason);
        }
        
        println!("   done {}\n", order_id);
        Ok(())
    }

    pub async fn spawn_order_task(
        router: Arc<MockDexRouter>,
        semaphore: Arc<tokio::sync::Semaphore>,
        status_tx: Arc<mpsc::Sender<StatusUpdate>>,
        order_id: String,
        token_in: String,
        token_out: String,
        amount: f64,
    ) {
        tokio::spawn(async move {
            let _permit = match semaphore.acquire().await {
                Ok(permit) => permit,
                Err(e) => {
                    println!("semaphore fail {}: {}", order_id, e);
                    return;
                }
            };
            
            println!("start: {}", order_id);
            
            if let Err(e) = Self::process_order_with_channel(&router, &status_tx, &order_id, &token_in, &token_out, amount).await {
                println!("proc err {}: {}", order_id, e);
            }
            
            println!("done: {}", order_id);
        });
    }
}
