use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub order_id: String,
    pub user_id: String,
    pub token_in: String,
    pub token_out: String,
    pub amount: u64,
    pub status: OrderStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderStatus {
    Pending,
    Routing,
    Building,
    Submitted,
    Confirmed { tx_hash: String },
    Failed { reason: String },
}

impl Order {
    pub fn new(order_id: String, user_id: String, token_in: String, token_out: String, amount: u64) -> Self {
        Self {
            order_id,
            user_id,
            token_in,
            token_out,
            amount,
            status: OrderStatus::Pending,
        }
    }

    pub fn update_status(&mut self, status: OrderStatus) {
        self.status = status;
    }
}
