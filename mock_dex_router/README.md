# Mock DEX Router

Simulates DEX interactions and processes orders with realistic delays and price variations.

## Purpose

The mock DEX router simulates real DEX behavior without requiring actual blockchain connections. It processes orders by comparing prices from multiple DEXs and executing swaps with realistic timing.

## How It Works

1. **Order Processing**: Receives orders from Redis stream
2. **Price Comparison**: Gets quotes from Raydium and Meteora
3. **Best Price Selection**: Routes to DEX with better price
4. **Slippage Protection**: Checks price movement against limits
5. **Execution Simulation**: Simulates transaction with retry logic
6. **Status Updates**: Sends progress updates via Redis

## Benefits

- **Realistic Simulation**: Mimics real DEX behavior and timing
- **Price Discovery**: Compares multiple DEXs for best execution
- **Slippage Protection**: Prevents execution at unfavorable prices
- **Retry Logic**: Handles execution failures with exponential backoff
- **Concurrent Processing**: Handles up to 10 orders simultaneously

## DEX Simulation

### Raydium
- Base price: ~$220 SOL/USDC
- Price variation: ±0.5%
- Fee: 0.3%

### Meteora  
- Base price: ~$218 SOL/USDC
- Price variation: ±0.5%
- Fee: 0.2%

## Order Processing Flow

```
pending → routing → building → submitted → confirmed/failed
```

Each step includes realistic delays:
- Routing: 200ms
- Building: 500ms  
- Execution: 2-3 seconds
- Retry delays: 1s, 2s, 4s

## Slippage Protection

- Monitors price movement during execution
- Compares against user's max slippage limit
- Fails orders that exceed limits
- Default max slippage: 1-5%

## Retry Logic

- Up to 3 execution attempts
- Exponential backoff between retries
- 70% success rate on first attempt
- Fails after 3 unsuccessful attempts

## Configuration

Environment variables:
- `REDIS_URL` - Redis connection for order queue
- `RUST_LOG` - Logging level

## Dependencies

- **redis** - Order queue and status updates
- **tokio** - Async runtime
- **uuid** - Transaction hash generation
- **rand** - Price variation and execution simulation

## Performance

- Processes 10 concurrent orders
- Handles 100+ orders per minute
- 2-3 second average execution time
- Realistic price movements (-2% to +2%)

## Error Handling

- Price slippage exceeds limits
- Execution failures after retries
- Redis connection issues
- Invalid order parameters
