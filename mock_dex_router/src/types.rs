use serde_json::json;

#[derive(Debug, Clone)]
pub struct StatusUpdate {
    pub order_id: String,
    pub status: String,
    pub tx_hash: Option<String>,
    pub reason: Option<String>,
    pub execution_price: Option<f64>,
}

impl StatusUpdate {
    pub fn to_redis_data(&self) -> serde_json::Value {
        json!({
            "order_id": self.order_id,
            "status": self.status,
            "tx_hash": self.tx_hash,
            "reason": self.reason,
            "execution_price": self.execution_price
        })
    }
}
