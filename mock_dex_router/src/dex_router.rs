use crate::models::{Order, OrderStatus};
use std::time::Duration;
use tokio::time::sleep;

pub struct MockDexRouter;

impl MockDexRouter {
    pub fn new() -> Self {
        Self
    }

    pub async fn get_raydium_quote(&self, _amount: u64) -> f64 {
        sleep(Duration::from_millis(200)).await;
        
        let base_price = 220.0;
        base_price * (0.995 + rand::random::<f64>() * 0.01)
    }

    pub async fn get_meteora_quote(&self, _amount: u64) -> f64 {
        sleep(Duration::from_millis(250)).await;
        
        let base_price = 218.0;
        base_price * (0.995 + rand::random::<f64>() * 0.01)
    }

    pub async fn execute_swap(&self, order: &Order, best_dex: &str) -> Result<(String, f64), String> {
        let delay = (2000.0 + rand::random::<f64>() * 1000.0) as u64;
        sleep(Duration::from_millis(delay)).await;

        if rand::random::<f64>() < 0.1 {
            return Err(format!("Simulated network failure on {}", best_dex));
        }

        let random_num: u64 = rand::random();
        let tx_hash = format!("0x{:016x}", random_num);
        
        let base_quote = match best_dex {
            "raydium" => self.get_raydium_quote(order.amount).await,
            "meteora" => self.get_meteora_quote(order.amount).await,
            _ => return Err(format!("Unknown DEX: {}", best_dex)),
        };

        let executed_price = base_quote * (0.999 + rand::random::<f64>() * 0.002);

        Ok((tx_hash, executed_price))
    }

    pub async fn execute_with_retry(&self, order: &mut Order, best_dex: &str) {
        let max_retries = 3;
        let retry_delays = vec![500, 1000, 2000];

        for attempt in 1..=max_retries {
            println!("Attempt {}: Executing swap on {}...", attempt, best_dex);
            
            match self.execute_swap(order, best_dex).await {
                Ok((tx_hash, executed_price)) => {
                    println!("Swap successful! TX: {}, Price: {:.4}", tx_hash, executed_price);
                    order.update_status(OrderStatus::Confirmed { tx_hash });
                    return;
                }
                Err(error) => {
                    println!("Attempt {} failed: {}", attempt, error);
                    
                    if attempt < max_retries {
                        let delay = retry_delays[attempt - 1];
                        println!("Waiting {}ms before retry...", delay);
                        sleep(Duration::from_millis(delay)).await;
                    } else {
                        println!("All {} attempts failed. Order marked as failed.", max_retries);
                        order.update_status(OrderStatus::Failed { 
                            reason: format!("Failed after {} attempts: {}", max_retries, error) 
                        });
                    }
                }
            }
        }
    }
}
