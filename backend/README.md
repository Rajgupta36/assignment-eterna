# Backend Service

WebSocket API that handles order submission and streams real-time status updates to users.

## Purpose

The backend service is the entry point for the order execution system. It accepts order requests, validates them, and provides live updates via WebSocket connections.

## How It Works

1. **Order Submission**: Users POST orders to `/api/orders/execute` with JSON payload
2. **WebSocket Connection**: Users connect to WebSocket at `/api/orders/status` and send order ID as plain text
3. **Order Validation**: Validates order parameters and slippage tolerance limits
4. **Redis Publishing**: Sends order data to Redis stream for processing
5. **Status Streaming**: Forwards real-time status updates from Redis to connected WebSocket clients

## Benefits

- **Real-time Updates**: Users see order progress instantly
- **Separate Concerns**: HTTP for order submission, WebSocket for status updates
- **Concurrent Handling**: Manages multiple orders simultaneously
- **Error Handling**: Validates inputs and handles connection failures

## API Endpoints

### POST /api/orders/execute
Submit a new order for execution.

**Request:**
```json
{
  "token_in": "SOL",
  "token_out": "USDC",
  "amount": 12.5,
  "order_type": "market",
  "max_slippage": 0.05
}
```

**Response:**
```json
{
  "order_id": "uuid-string",
  "status": "pending"
}
```

### GET /api/orders/status (WebSocket)
Connect to WebSocket for real-time status updates. Send the order ID as plain text (not JSON) as the first message.

**WebSocket Messages:** Real-time status updates for the specified order

### WebSocket Messages
Orders progress through these statuses:

```json
{"order_id": "uuid", "status": "pending"}
{"order_id": "uuid", "status": "routing"}
{"order_id": "uuid", "status": "building"}
{"order_id": "uuid", "status": "submitted", "tx_hash": "0x..."}
{"order_id": "uuid", "status": "confirmed", "tx_hash": "0x...", "execution_price": 220.45}
{"order_id": "uuid", "status": "failed", "reason": "Price moved 1.8% (max allowed: 1.0%)"}
```

## Configuration

Environment variables:
- `SERVER_PORT` - Port to listen on (default: 3000)
- `REDIS_URL` - Redis connection string

## Dependencies

- **axum** - Web framework with WebSocket support
- **redis** - Message broker for inter-service communication
- **uuid** - Order ID generation
- **serde** - JSON serialization

## Error Handling

- Invalid slippage values (must be 0.01-0.5)
- Connection failures to Redis
- WebSocket connection drops
- Order validation errors

## Performance

- Handles 100+ concurrent WebSocket connections
- Processes orders in under 100ms
- Automatic connection cleanup on completion
