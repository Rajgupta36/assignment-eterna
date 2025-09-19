use serde_json::Value;

pub struct StreamParser;

impl StreamParser {
    pub fn parse_redis_stream_response(
        value: redis::Value,
    ) -> Result<Vec<ParsedMessage>, Box<dyn std::error::Error + Send + Sync>> {
        let messages = Self::extract_messages(value)?;
                            let mut parsed_messages = Vec::new();
                            
                            for message in messages {
            if let Some(parsed) = Self::parse_message(message) {
                parsed_messages.push(parsed);
            }
        }
        
        Ok(parsed_messages)
    }

    fn extract_messages(value: redis::Value) -> Result<Vec<redis::Value>, Box<dyn std::error::Error + Send + Sync>> {
        let streams = match value {
            redis::Value::Bulk(streams) if !streams.is_empty() => streams,
            _ => return Ok(vec![]),
        };

        let stream_data = match &streams[0] {
            redis::Value::Bulk(data) if data.len() >= 2 => &data[1],
            _ => return Ok(vec![]),
        };

        match stream_data {
            redis::Value::Bulk(messages) => Ok(messages.clone()),
            _ => Ok(vec![]),
        }
    }

    fn parse_message(message: redis::Value) -> Option<ParsedMessage> {
        let message_data = match message {
            redis::Value::Bulk(data) if data.len() >= 2 => data,
            _ => return None,
        };

        let message_id = Self::get_string(&message_data[0])?;
        let fields_data = match &message_data[1] {
            redis::Value::Bulk(data) => data,
            _ => return None,
        };

        let order_json = Self::find_order_data(fields_data)?;
        let order_data: Value = serde_json::from_str(&order_json).ok()?;
        
        Some(ParsedMessage {
            message_id,
            order_id: order_data.get("order_id")?.as_str()?.to_string(),
            token_in: order_data.get("token_in")?.as_str()?.to_string(),
            token_out: order_data.get("token_out")?.as_str()?.to_string(),
            amount: order_data.get("amount")?.as_f64()?,
            max_slippage: order_data.get("max_slippage").and_then(|v| v.as_f64()).unwrap_or(5.0),
        })
    }

    fn find_order_data(fields_data: &[redis::Value]) -> Option<String> {
        for i in (0..fields_data.len()).step_by(2) {
            if i + 1 < fields_data.len() {
                if let (Some(key), Some(value)) = (
                    Self::get_string(&fields_data[i]),
                    Self::get_string(&fields_data[i + 1])
                ) {
                    if key == "order_data" {
                        return Some(value);
                    }
                }
            }
        }
        None
    }

    fn get_string(value: &redis::Value) -> Option<String> {
        match value {
            redis::Value::Data(data) => Some(String::from_utf8_lossy(data).to_string()),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ParsedMessage {
    pub message_id: String,
    pub order_id: String,
    pub token_in: String,
    pub token_out: String,
    pub amount: f64,
    pub max_slippage: f64,
}
