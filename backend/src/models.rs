use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct OrderRequest {
    pub token_in: String,
    pub token_out: String,
    pub amount: f64,
    pub order_type: String,
}
