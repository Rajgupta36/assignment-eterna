use serde_json::json;

#[derive(Debug, Clone)]
pub struct StatusUpdate {
    pub order_id: String,
    pub status: String,
    pub tx_hash: Option<String>,
    pub reason: Option<String>,
}

impl StatusUpdate {
    pub fn to_redis_data(&self) -> serde_json::Value {
        json!({
            "order_id": self.order_id,
            "status": self.status,
            "tx_hash": self.tx_hash,
            "reason": self.reason
        })
    }
}
