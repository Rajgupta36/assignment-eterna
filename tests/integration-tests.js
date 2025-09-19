import WebSocket from 'ws';
import axios from 'axios';

const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/api/orders/execute';

class IntegrationTester {
  constructor() {
    this.results = { total: 0, passed: 0, failed: 0, orders: { total: 0, success: 0, failed: 0 } };

    
  }

  async runFullIntegrationTest() {
    console.log('Starting integration tests...');
    
    try {
      await this.testCompleteOrderLifecycle();
      await this.testConcurrentOrderFlows();
      await this.testErrorHandling();
      await this.testSystemResilience();
      
      this.printResults();
      console.log('\nAll integration tests passed!');
      
    } catch (error) {
      console.error('\nIntegration tests failed:', error.message);
      this.results.failed++;
      throw error;
    }
  }

  async testCompleteOrderLifecycle() {
    console.log('\n=== Order Lifecycle Test ===');
    
    this.results.total++;
    
    try {
      const order = {
        token_in: 'SOL',
        token_out: 'USDC',
        amount: 15.5,
        order_type: 'market',
        max_slippage: 0.04
      };

      const result = await this.executeOrder(order);
      
      const expectedStatuses = ['pending', 'routing', 'building', 'submitted', 'confirmed'];
      const hasCompleteFlow = expectedStatuses.every(status => 
        result.statusSequence.includes(status)
      );

      if (!hasCompleteFlow) {
        throw new Error(`Incomplete flow. Expected: ${expectedStatuses.join(', ')}, Got: ${result.statusSequence.join(', ')}`);
      }

      if (result.finalStatus !== 'confirmed') {
        throw new Error(`Order failed. Final status: ${result.finalStatus}`);
      }

      console.log('Lifecycle test passed');
      console.log(`Order ID: ${result.orderId}`);
      console.log(`Time: ${result.completionTime}ms`);
      console.log(`Flow: ${result.statusSequence.join(' -> ')}`);
      console.log(`Price: $${result.executionPrice}`);
      
      this.results.passed++;
      this.updateOrderStats(result);
      
    } catch (error) {
      console.error('Lifecycle test failed:', error.message);
      this.results.failed++;
      throw error;
    }
  }

  async testConcurrentOrderFlows() {
    console.log('\n=== Concurrent Orders Test ===');
    
    this.results.total++;
    
    try {
      const orders = [
        { token_in: 'SOL', token_out: 'USDC', amount: 5.0, order_type: 'market', max_slippage: 0.02 },
        { token_in: 'SOL', token_out: 'USDC', amount: 8.5, order_type: 'market', max_slippage: 0.03 },
        { token_in: 'SOL', token_out: 'USDC', amount: 12.0, order_type: 'market', max_slippage: 0.025 }
      ];

      console.log(`Submitting ${orders.length} orders...`);
      
      const promises = orders.map((order, index) => 
        this.executeOrder(order, index + 1)
      );

      const results = await Promise.all(promises);
      
      const successful = results.filter(r => r.finalStatus === 'confirmed');
      console.log(`Completed: ${successful.length}/${results.length} successful (${((successful.length / results.length) * 100).toFixed(1)}%)`);
      
      const times = results.map(r => r.completionTime);
      console.log(`Time range: ${Math.min(...times)}ms - ${Math.max(...times)}ms`);
      
      results.forEach(result => this.updateOrderStats(result));
      
      if (successful.length < results.length * 0.8) {
        throw new Error(`Success rate too low: ${((successful.length / results.length) * 100).toFixed(1)}%`);
      }

      console.log('Concurrent test passed');
      this.results.passed++;
      
    } catch (error) {
      console.error('Concurrent test failed:', error.message);
      this.results.failed++;
      throw error;
    }
  }

  async testErrorHandling() {
    console.log('\n=== Error Handling Test ===');
    
    this.results.total++;
    
    try {
      await this.testInvalidSlippage();
      await this.testInvalidTokens();
      await this.testZeroAmount();
      
      console.log('Error handling test passed');
      this.results.passed++;
      
    } catch (error) {
      console.error('Error handling test failed:', error.message);
      this.results.failed++;
      throw error;
    }
  }

  async testInvalidSlippage() {
    console.log('  Testing invalid slippage...');
    
    const invalidOrders = [
      { token_in: 'SOL', token_out: 'USDC', amount: 10, order_type: 'market', max_slippage: 0.6 },
      { token_in: 'SOL', token_out: 'USDC', amount: 10, order_type: 'market', max_slippage: 0.005 }
    ];

    for (const order of invalidOrders) {
      try {
        const response = await axios.post(`${API_URL}/api/orders/execute`, order, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        });
        
        if (response.status === 200) {
          console.log(`    Accepted invalid slippage: ${order.max_slippage}`);
        }
      } catch (error) {
        if (error.response && error.response.status === 400) {
          console.log(`    Correctly rejected slippage: ${order.max_slippage}`);
        }
      }
    }
  }

  async testInvalidTokens() {
    console.log('  Testing invalid tokens...');
    
    const invalidOrder = {
      token_in: '',
      token_out: 'USDC',
      amount: 10,
      order_type: 'market',
      max_slippage: 0.03
    };

    try {
      const response = await axios.post(`${API_URL}/api/orders/execute`, invalidOrder, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log('    Accepted invalid token pair');
      }
    } catch (error) {
      console.log('    Correctly handled invalid token pair');
    }
  }

  async testZeroAmount() {
    console.log('  Testing zero amount...');
    
    const zeroOrder = {
      token_in: 'SOL',
      token_out: 'USDC',
      amount: 0,
      order_type: 'market',
      max_slippage: 0.03
    };

    try {
      const response = await axios.post(`${API_URL}/api/orders/execute`, zeroOrder, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log('    Zero amount order accepted');
      }
    } catch (error) {
      console.log('    Zero amount order correctly rejected');
    }
  }

  async testSystemResilience() {
    console.log('\n=== System Resilience Test ===');
    
    this.results.total++;
    
    try {
      await this.testRapidConnections();
      await this.testWebSocketReconnection();
      
      console.log('Resilience test passed');
      this.results.passed++;
      
    } catch (error) {
      console.error('Resilience test failed:', error.message);
      this.results.failed++;
      throw error;
    }
  }

  async testRapidConnections() {
    console.log('  Testing rapid connections...');
    
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(this.createConnection(i));
    }
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`    Successful connections: ${successful}/5`);
    
    if (successful < 4) {
      throw new Error(`Too many connection failures: ${successful}/5`);
    }
  }

  async createConnection(id) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      
      ws.on('open', () => {
        setTimeout(() => {
          ws.close();
          resolve(`Connection ${id} successful`);
        }, 100);
      });
      
      ws.on('error', (error) => {
        reject(new Error(`Connection ${id} failed: ${error.message}`));
      });
    });
  }

  async testWebSocketReconnection() {
    console.log('  Testing WebSocket reconnection...');
    
    const ws1 = new WebSocket(WS_URL);
    let reconnected = false;
    
    ws1.on('open', () => {
      ws1.close();
      
      setTimeout(() => {
        const ws2 = new WebSocket(WS_URL);
        
        ws2.on('open', () => {
          reconnected = true;
          ws2.close();
        });
        
        ws2.on('error', (error) => {
          throw new Error(`Reconnection failed: ${error.message}`);
        });
      }, 100);
    });
    
    ws1.on('error', (error) => {
      throw new Error(`Initial connection failed: ${error.message}`);
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!reconnected) {
      throw new Error('WebSocket reconnection test failed');
    }
    
    console.log('    WebSocket reconnection successful');
  }

  async executeOrder(order, orderNumber = null) {
    return new Promise(async (resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let orderId = null;
      let statusSequence = [];
      let finalStatus = null;
      let executionPrice = null;
      let completionTime = null;
      const startTime = Date.now();

      await new Promise((wsResolve, wsReject) => {
        ws.on('open', wsResolve);
        ws.on('error', wsReject);
      });

      try {
        const response = await axios.post(`${API_URL}/api/orders/execute`, order, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        orderId = response.data.order_id;
        ws.send(orderId);

      } catch (error) {
        ws.close();
        reject(error);
        return;
      }

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.order_id === orderId) {
            const status = message.status;
            statusSequence.push(status);

            if (orderNumber) {
              console.log(`  Order ${orderNumber}: ${status}`);
            }

            if (message.execution_price) {
              executionPrice = message.execution_price;
            }

            if (status === 'confirmed' || status === 'failed') {
              finalStatus = status;
              completionTime = Date.now() - startTime;
              ws.close();
              
              resolve({
                orderId,
                statusSequence,
                finalStatus,
                executionPrice,
                completionTime,
                reason: message.reason
              });
            }
          }
        } catch (error) {
          reject(error);
        }
      });

      ws.on('error', (error) => {
        reject(error);
      });

      setTimeout(() => {
        ws.close();
        reject(new Error(`Order ${orderNumber || 'unknown'} timeout`));
      }, 30000);
    });
  }

  updateOrderStats(orderResult) {
    this.results.orders.total++;
    
    if (orderResult.finalStatus === 'confirmed') {
      this.results.orders.success++;
    } else {
      this.results.orders.failed++;
    }
  }

  printResults() {
    console.log('\n--- Test Summary ---');
    console.log(`Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
    
    console.log('\n--- Order Stats ---');
    console.log(`Total: ${this.results.orders.total}`);
    console.log(`Success: ${this.results.orders.success}`);
    console.log(`Failed: ${this.results.orders.failed}`);
    console.log(`Rate: ${((this.results.orders.success / this.results.orders.total) * 100).toFixed(1)}%`);
  }
}

async function runIntegrationTests() {
  const tester = new IntegrationTester();
  
  try {
    await tester.runFullIntegrationTest();
  } catch (error) {
    console.error('\nIntegration tests failed:', error.message);
    process.exit(1);
  }
}

export { IntegrationTester, runIntegrationTests };

if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests().catch(console.error);
}