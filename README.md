# Order Execution Engine

A microservices-based order execution system that processes market orders with DEX routing and real-time WebSocket updates.

## Architecture

![System Architecture](./architecture.png)

This system consists of 4 services working together:

- **[Backend](./backend/README.md)** - WebSocket API for order submission and status updates
- **[Mock DEX Router](./mock_dex_router/README.md)** - Processes orders and simulates DEX interactions
- **[Database Service](./db-service/README.md)** - Stores final order results in PostgreSQL
- **[Tester](./tester/README.md)** - Node.js service for test.
- **Infrastructure** - PostgreSQL database and Redis message broker


## Order Types

**Market Orders** - Execute immediately at current market price

I chose market orders because they are the most common and straightforward to implement. The same engine can be extended to support other types:

Limit Orders: Add price monitoring and maintain an order book (array) to store and track orders until the target price is reached.

Sniper Orders: Detect new token launches and execute trades instantly using automated event monitoring, with a dedicated processing stream for maximum speed.


## Quick Start

```bash
docker compose up 
```

The system will be available at `http://localhost:3000`

## Order Flow

1. **Order Submission**: User submits order via POST `/api/orders/execute` with JSON payload
2. **WebSocket Connection**: User connects to WebSocket at `/api/orders/status` and sends order ID
3. **Order Validation**: Backend validates order parameters and slippage tolerance
4. **Order Processing**: Mock DEX router processes the order through Redis streams
5. **Real-time Updates**: Status updates sent via WebSocket (pending → routing → building → submitted → confirmed/failed)
6. **Database Storage**: Final order results stored in PostgreSQL via database service

## API Design

The system uses a two-step approach for order submission and real-time updates:

1. **POST Request**: Client sends order data via HTTP POST to `/api/orders/execute`
2. **WebSocket Connection**: Client connects to WebSocket at `/api/orders/execute` and sends the order ID as plain text
3. **Real-time Updates**: Client receives status updates via WebSocket connection

This approach separates order submission (HTTP) from status monitoring (WebSocket) for better reliability and easier client implementation. The WebSocket connection is registered by sending the order ID as a plain text message (not JSON).

### WebSocket Connection Process
The test suite demonstrates the complete HTTP-to-WebSocket upgrade process:
- HTTP POST order submission with detailed response logging
- HTTP GET upgrade request with WebSocket key generation
- WebSocket connection establishment and order ID registration
- Real-time status update monitoring with comprehensive logging

## Status Updates

Orders progress through these states:
- `pending` - Order received
- `routing` - Comparing DEX prices  
- `building` - Creating transaction
- `submitted` - Transaction sent
- `confirmed` - Success (includes txHash and execution price)
- `failed` - Error occurred (includes reason)

## Services

### Backend Service
Handles order submission and WebSocket connections. Validates orders and streams status updates to users.

### Mock DEX Router  
Simulates Raydium and Meteora DEX interactions. Compares prices, handles slippage protection, and executes swaps with realistic delays.

### Database Service
Monitors Redis for final order statuses and stores confirmed/failed orders in PostgreSQL for persistence.

## Tech Stack

- **Rust** - All services written in Rust
- **Axum** - Web framework for backend
- **Redis** - Message streaming between services
- **PostgreSQL** - Order persistence
- **Docker** - Containerization

## Testing

### Comprehensive Test Suite
The system includes a comprehensive test suite with acknowledgment handling and detailed WebSocket connection logging:

```bash
cd tests
npm install

# Run all tests
node test-runner.js

# Run specific test suites
node acknowledgment-tests.js 
node integration-tests.js 
```

### Test Features
- **HTTP POST Order Submission**: Validates order creation and response handling
- **WebSocket Connection Upgrades**: Tests HTTP GET upgrade to WebSocket connections
- **Real-time Status Tracking**: Monitors complete order lifecycle (pending → routing → building → submitted → confirmed)
- **Concurrent Order Processing**: Tests multiple simultaneous orders
- **Error Handling**: Validates timeout scenarios and failure recovery
- **Comprehensive Logging**: Detailed visibility into HTTP-to-WebSocket upgrade process

### Test Coverage
- ✅ Single order acknowledgment tests
- ✅ Concurrent order processing (3+ orders)
- ✅ WebSocket connection and reconnection
- ✅ Slippage validation testing
- ✅ Error handling and timeout scenarios
- ✅ Complete order lifecycle validation

### Manual API Usage
```bash
# Step 1: Submit order via POST
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "token_in": "SOL",
    "token_out": "USDC", 
    "amount": 12.5,
    "order_type": "market",
    "max_slippage": 0.05
  }'

# Response: {"order_id": "uuid-string"}

# Step 2: Connect to WebSocket and send order ID as plain text
wscat -c ws://localhost:3000/api/orders/execute
# Then send the order ID (not JSON, just the UUID string)
```

### Running Tests
```bash
# Run comprehensive test suite
cd tests && node test-runner.js

# Individual test suites
node acknowledgment-tests.js    # Acknowledgment and timeout tests
node integration-tests.js       # Full integration and lifecycle tests
```

### Example WebSocket Messages
You'll receive real-time status updates like:
```json
{"order_id": "uuid", "status": "pending", "execution_price": null, "tx_hash": null}
{"order_id": "uuid", "status": "routing", "execution_price": null, "tx_hash": null}
{"order_id": "uuid", "status": "building", "execution_price": null, "tx_hash": null}
{"order_id": "uuid", "status": "submitted", "execution_price": null, "tx_hash": "0x..."}
{"order_id": "uuid", "status": "confirmed", "execution_price": 218.06, "tx_hash": "0x..."}
```

## Performance

- Processes up to 10 concurrent orders
- Handles 100+ orders per minute
- 2-3 second execution time per order
- Real-time WebSocket updates

**Solution**: Use separate endpoints:
- POST `/api/orders/execute` for order submission
- GET `/api/orders/status` for WebSocket connection

## Development

Each service has its own README with detailed setup instructions. See the individual service directories for more information.
