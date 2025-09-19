use serde_json::Value;

pub struct StreamParser;

impl StreamParser {
    pub fn parse_redis_stream_response(
        value: redis::Value,
    ) -> Result<Vec<ParsedMessage>, Box<dyn std::error::Error + Send + Sync>> {
        match value {
            redis::Value::Bulk(streams) => {
                if streams.is_empty() {
                    return Ok(vec![]);
                }
                
                if let Some(redis::Value::Bulk(stream_data)) = streams.first() {
                    if stream_data.len() >= 2 {
                        if let redis::Value::Bulk(messages) = &stream_data[1] {
                            let mut parsed_messages = Vec::new();
                            
                            for message in messages {
                                if let redis::Value::Bulk(message_data) = message {
                                    if message_data.len() >= 2 {
                                        let message_id = match &message_data[0] {
                                            redis::Value::Data(id) => String::from_utf8_lossy(id).to_string(),
                                            _ => continue,
                                        };
                                        
                                        if let redis::Value::Bulk(fields_data) = &message_data[1] {
                                            let mut fields = Vec::new();
                                            for i in (0..fields_data.len()).step_by(2) {
                                                if i + 1 < fields_data.len() {
                                                    let key = match &fields_data[i] {
                                                        redis::Value::Data(k) => String::from_utf8_lossy(k).to_string(),
                                                        _ => continue,
                                                    };
                                                    let value = match &fields_data[i + 1] {
                                                        redis::Value::Data(v) => String::from_utf8_lossy(v).to_string(),
                                                        _ => continue,
                                                    };
                                                    fields.push((key, value));
                                                }
                                            }
                                            
                                            if let Some((_, order_json)) = fields.iter().find(|(key, _)| key == "order_data") {
                                                match serde_json::from_str::<Value>(order_json) {
                                                    Ok(order_data) => {
                                                        if let (Some(order_id), Some(token_in), Some(token_out), Some(amount)) = (
                                                            order_data.get("order_id").and_then(|v| v.as_str()),
                                                            order_data.get("token_in").and_then(|v| v.as_str()),
                                                            order_data.get("token_out").and_then(|v| v.as_str()),
                                                            order_data.get("amount").and_then(|v| v.as_f64()),
                                                        ) {
                                                            parsed_messages.push(ParsedMessage {
                                                                message_id,
                                                                order_id: order_id.to_string(),
                                                                token_in: token_in.to_string(),
                                                                token_out: token_out.to_string(),
                                                                amount,
                                                            });
                                                        } else {
                                                            println!("missing fields: {:?}", order_data);
                                                        }
                                                    }
                                                    Err(e) => {
                                                        println!("parse err: {}", e);
                                                        println!("   raw: {}", order_json);
                                                    }
                                                }
                                            } else {
                                                println!("no order_data field");
                                                println!("   fields: {:?}", fields.iter().map(|(k, _)| k).collect::<Vec<_>>());
                                            }
                                        }
                                    }
                                }
                            }
                            
                            return Ok(parsed_messages);
                        }
                    }
                }
                Ok(vec![])
            }
            _ => Ok(vec![]),
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
}
