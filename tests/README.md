# Order Execution Engine Test Suite

Comprehensive test suite for the Order Execution Engine with acknowledgment handling and integration testing capabilities.

## Test Case Locations

### Core Test Files
- **`acknowledgment-tests.js`** - Tests that require proper acknowledgment of each status update
- **`integration-tests.js`** - End-to-end testing of the complete order lifecycle  

### Test Configuration
- **`package.json`** - Test dependencies and npm scripts
- **`README.md`** - This documentation file

## Key Test Requirements

### Acknowledgment Handling (Primary Focus)
- Tests require proper acknowledgment of each status update
- Not just "send request and wait for response"
- Real-time status tracking with acknowledgment verification
- Complete order lifecycle validation (pending → routing → building → submitted → confirmed)

### Integration Testing
- End-to-end order flow validation
- Concurrent order processing
- Error handling and recovery
- System resilience testing
- Data consistency verification

## Installation

```bash
cd tests
npm install
```

## Usage

### Run All Tests
```bash
npm test
# or
node test-runner.js
```

### Run Specific Test Suites
```bash
# Acknowledgment tests only
npm run test:acknowledgment

# Integration tests only
npm run test:integration
```

### Run Individual Test Files
```bash
# Acknowledgment tests
node acknowledgment-tests.js

# Integration tests
node integration-tests.js
```

## Test Suites Overview

### 1. Acknowledgment Tests (`acknowledgment-tests.js`)

**Purpose**: Verify proper acknowledgment handling and status update flow

**Test Cases**:
- Order with Full Acknowledgment - Complete order lifecycle with status acknowledgment
- Concurrent Orders with Acknowledgment - Multiple orders with proper acknowledgment tracking  
- Acknowledgment Timeout - Handling of acknowledgment timeouts

**Key Features**:
- Proper acknowledgment of each status update
- Response time tracking for each status transition
- Concurrent order acknowledgment handling
- No throughput or performance metrics (focus on functionality only)

### 2. Integration Tests (`integration-tests.js`)

**Purpose**: End-to-end testing of the complete system

**Test Cases**:
- Complete Order Lifecycle - Full order flow validation
- Concurrent Order Flows - Multiple simultaneous orders
- Error Handling and Recovery - Invalid input handling
- System Resilience - Connection handling and recovery
- Data Consistency - Cross-service data validation

**Test Categories**:
- Complete order lifecycle validation
- Concurrent order processing
- Error handling and recovery
- System resilience testing
- Data consistency verification
- No performance or throughput metrics (focus on functionality only)

## Test Configuration

### Environment Variables
```bash
# API Configuration
API_URL=http://localhost:3000
WS_URL=ws://localhost:3000/api/orders/status
```

### Test Parameters
```javascript
// Acknowledgment tests
await tester.testConcurrentOrdersWithAcknowledgment(3); // 3 concurrent orders

// Integration tests
await tester.testConcurrentOrderFlows(); // 5 concurrent orders by default
```

## Expected Results

### Acknowledgment Requirements
- All status updates must be acknowledged
- Response times tracked for each status transition
- Proper handling of WebSocket connections
- Graceful timeout handling
- Complete status flow: pending → routing → building → submitted → confirmed

### Performance Metrics (Removed)
- Throughput and RPS metrics have been removed
- Focus is purely on functional testing
- Response time tracking for acknowledgment verification only

## Test Output

### Console Output
```
Starting tests...

=== Single Order Test ===
Submitting order...
Order ID: 924809c7-18b3-4e49-a58b-d4ef7390cd66
Status: pending
Listening for updates...
Status: pending
  -> Pending
Status: routing
  -> Routing
Status: building
  -> Building tx
Status: submitted
  -> Submitted
  -> TX: 0xde44aee3de5d4d789d377642637e7e61
Status: confirmed
  -> Confirmed!
  -> Price: $219.0310683547906
  -> TX: 0xde44aee3de5d4d789d377642637e7e61

--- Results ---
Total time: 2706ms
Flow: pending -> routing -> building -> submitted -> confirmed
Times: 148ms, 849ms, 1711ms, 2205ms, 2706ms
Final: confirmed
```

### Final Metrics Summary
```
--- Final Stats ---
Total: 3
Acked: 4
Failed: 0
Success: 133.3%
Avg time: 1559ms
Min: 109ms
Max: 3878ms
```

## Prerequisites

Before running tests:
- Order Execution Engine must be running on http://localhost:3000
- All services (backend, mock_dex_router, db-service) must be active
- Redis and PostgreSQL must be accessible

To start the Order Execution Engine:
```bash
cd .. && docker compose up
```

## Troubleshooting

### Common Issues

1. **Connection Timeouts**
   - Ensure the Order Execution Engine is running
   - Check that all services are accessible
   - Verify network connectivity

2. **WebSocket Connection Failures**
   - Confirm WebSocket endpoint is available
   - Check firewall settings
   - Verify WebSocket URL configuration

3. **Missing Status Updates**
   - Verify mock_dex_router is processing orders
   - Check Redis connection between services
   - Ensure WebSocket registration is working

4. **Low Success Rates**
   - Check system resources (CPU, memory)
   - Verify database connectivity
   - Monitor Redis connection status

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Include proper acknowledgment handling
3. Focus on functional testing over performance metrics
4. Document expected results
5. Update this README with new test descriptions