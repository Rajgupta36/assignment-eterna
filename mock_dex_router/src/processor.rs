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
        max_slippage: f64,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        
        Self::send_status(status_tx, order_id, "pending", None, None).await?;
        println!("   pending...");
        
        Self::send_status(status_tx, order_id, "routing", None, None).await?;
        println!("   routing...");
        
        let (best_dex, best_price) = Self::get_best_price(router, amount).await;
        println!("   best: {} {:.4}", best_dex, best_price);
        
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        
        let slippage = Self::check_slippage(best_price, max_slippage).await;
        if slippage > max_slippage {
            let reason = format!("Price moved {:.2}% (max allowed: {:.2}%)", slippage, max_slippage);
            Self::send_status(status_tx, order_id, "failed", None, Some(&reason)).await?;
            println!("   fail");
            println!("   why: {}", reason);
            return Ok(());
        }
        
        Self::send_status(status_tx, order_id, "building", None, None).await?;
        println!("   building...");
        
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        
        let tx_hash = format!("0x{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
        Self::send_status(status_tx, order_id, "submitted", Some(&tx_hash), None).await?;
        println!("   submitted...");
        
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        
        let success = Self::execute_with_retry(status_tx, order_id, &tx_hash).await;
        if success {
            Self::send_status(status_tx, order_id, "confirmed", Some(&tx_hash), None).await?;
            println!("   ok");
            println!("   tx: {}", tx_hash);
        } else {
            let reason = "Execution failed after 3 retry attempts";
            Self::send_status(status_tx, order_id, "failed", None, Some(reason)).await?;
            println!("   fail");
            println!("   why: {}", reason);
        }
        
        println!("   done {}\n", order_id);
        Ok(())
    }

    async fn send_status(
        status_tx: &mpsc::Sender<StatusUpdate>,
        order_id: &str,
        status: &str,
        tx_hash: Option<&str>,
        reason: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let status_update = StatusUpdate {
            order_id: order_id.to_string(),
            status: status.to_string(),
            tx_hash: tx_hash.map(|s| s.to_string()),
            reason: reason.map(|s| s.to_string()),
        };
        status_tx.send(status_update).await?;
        Ok(())
    }

    async fn get_best_price(router: &MockDexRouter, amount: f64) -> (&'static str, f64) {
        let raydium_price = router.get_raydium_quote(amount as u64).await;
        let meteora_price = router.get_meteora_quote(amount as u64).await;
        
        println!("   ray: {:.4}", raydium_price);
        println!("   met: {:.4}", meteora_price);
        
        if raydium_price > meteora_price {
            ("raydium", raydium_price)
        } else {
            ("meteora", meteora_price)
        }
    }

    async fn check_slippage(best_price: f64, _max_slippage: f64) -> f64 {
        let price_movement = Self::simulate_price_movement();
        let final_price = best_price * (1.0 + price_movement / 100.0);
        let slippage = price_movement.abs();
        
        println!("   price moved: {:.2}%", price_movement);
        println!("   final price: {:.4}", final_price);
        
        slippage
    }

    async fn execute_with_retry(
        status_tx: &mpsc::Sender<StatusUpdate>,
        order_id: &str,
        tx_hash: &str,
    ) -> bool {
        const MAX_RETRIES: u32 = 3;
        const BASE_DELAY_MS: u64 = 1000;

        for attempt in 1..=MAX_RETRIES {
            println!("   attempt {}/{}", attempt, MAX_RETRIES);
            
            let success = Self::simulate_execution().await;
            if success {
                println!("   success on attempt {}", attempt);
                return true;
            }
            
            if attempt < MAX_RETRIES {
                let delay_ms = BASE_DELAY_MS * (2_u64.pow(attempt - 1));
                println!("   retry in {}ms", delay_ms);
                tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
            }
        }
        
        false
    }

    async fn simulate_execution() -> bool {
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        rand::random::<f32>() > 0.3
    }

    fn simulate_price_movement() -> f64 {
        let movement = (rand::random::<f64>() - 0.5) * 10.0;
        movement
    }

    pub async fn spawn_order_task(
        router: Arc<MockDexRouter>,
        semaphore: Arc<tokio::sync::Semaphore>,
        status_tx: Arc<mpsc::Sender<StatusUpdate>>,
        order_id: String,
        token_in: String,
        token_out: String,
        amount: f64,
        max_slippage: f64,
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
            
            if let Err(e) = Self::process_order_with_channel(&router, &status_tx, &order_id, &token_in, &token_out, amount, max_slippage).await {
                println!("proc err {}: {}", order_id, e);
            }
            
            println!("done: {}", order_id);
        });
    }
}
