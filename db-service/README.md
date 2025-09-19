# Database Service

This service monitors Redis streams for order status updates and stores them in PostgreSQL.

## Features

- Monitors Redis `status_updates` stream
- Stores order data in PostgreSQL database
- Handles both new orders and updates to existing orders
- Includes execution price tracking

## Database Schema

The service creates an `orders` table with the following structure:

```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL,
    tx_hash VARCHAR(255),
    reason TEXT,
    execution_price DECIMAL(20, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (default: `postgres://postgres:password@localhost:5432/order_db`)
- `REDIS_URL`: Redis connection string (default: `redis://127.0.0.1:6379`)

## Usage

1. Set up PostgreSQL database
2. Run migrations to create the orders table
3. Start the service:

```bash
cargo run
```

## Example Status Update

The service processes status updates like:

```json
{
    "execution_price": 219.45,
    "order_id": "bcb0fd21-b5c5-406c-ab7f-34294579e54c",
    "reason": null,
    "status": "confirmed",
    "tx_hash": "0x1234567890abcdef..."
}
```

## Database Operations

- **New Order**: Inserts a new record when an order_id is not found
- **Update Order**: Updates existing record when order_id already exists
- **Execution Price**: Stores the final execution price when order is confirmed
