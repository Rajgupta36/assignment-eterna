use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Order {
    pub id: i32,
    pub order_id: String,
    pub status: String,
    pub tx_hash: Option<String>,
    pub reason: Option<String>,
    pub execution_price: Option<rust_decimal::Decimal>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NewOrder {
    pub order_id: String,
    pub status: String,
    pub tx_hash: Option<String>,
    pub reason: Option<String>,
    pub execution_price: Option<rust_decimal::Decimal>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StatusUpdate {
    pub order_id: String,
    pub status: String,
    pub tx_hash: Option<String>,
    pub reason: Option<String>,
    pub execution_price: Option<f64>,
}

impl From<StatusUpdate> for NewOrder {
    fn from(status_update: StatusUpdate) -> Self {
        NewOrder {
            order_id: status_update.order_id,
            status: status_update.status,
            tx_hash: status_update.tx_hash,
            reason: status_update.reason,
            execution_price: status_update.execution_price.map(|price| {
                rust_decimal::Decimal::from_f64_retain(price).unwrap_or_default()
            }),
        }
    }
}
