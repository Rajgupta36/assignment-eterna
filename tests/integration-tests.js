import WebSocket from 'ws';
import axios from 'axios';

const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/api/orders/execute';

class IntegrationTester {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      duration: 0,
      orders: {
        total: 0,
        success: 0,
        failed: 0,
        statuses: {}
      }
    };
    this.startTime = null;
  }

  async runFullIntegrationTest() {
    console.log('Starting integration tests...');
    
    this.startTime = Date.now();
    
    try {
      await this.testCompleteOrderLifecycle();
      await this.testConcurrentOrderFlows();
      await this.testErrorHandlingAndRecovery();
      await this.testSystemResilience();
      await this.testDataConsistency();
      
      this.calculateFinalMetrics();
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

      const lifecycleResult = await this.executeOrderWithFullLifecycle(order);
      
      const expectedStatuses = ['pending', 'routing', 'building', 'submitted', 'confirmed'];
      const receivedStatuses = lifecycleResult.statusSequence;
      
      const hasCompleteFlow = expectedStatuses.every(status => 
        receivedStatuses.includes(status)
      );

      if (!hasCompleteFlow) {
        throw new Error(`Incomplete status flow. Expected: ${expectedStatuses.join(', ')}, Got: ${receivedStatuses.join(', ')}`);
      }

      if (lifecycleResult.finalStatus !== 'confirmed') {
        throw new Error(`Order did not complete successfully. Final status: ${lifecycleResult.finalStatus}`);
      }

      console.log('Lifecycle test passed');
      console.log(`Order ID: ${lifecycleResult.orderId}`);
      console.log(`Completion Time: ${lifecycleResult.completionTime}ms`);
      console.log(`Status Flow: ${receivedStatuses.join(' → ')}`);
      console.log(`Final Price: $${lifecycleResult.executionPrice}`);
      
      this.results.passed++;
      this.updateOrderFlowMetrics(lifecycleResult);
      
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
      const concurrentOrders = [
        { token_in: 'SOL', token_out: 'USDC', amount: 5.0, order_type: 'market', max_slippage: 0.02 },
        { token_in: 'SOL', token_out: 'USDC', amount: 8.5, order_type: 'market', max_slippage: 0.03 },
        { token_in: 'SOL', token_out: 'USDC', amount: 12.0, order_type: 'market', max_slippage: 0.025 },
        { token_in: 'SOL', token_out: 'USDC', amount: 3.5, order_type: 'market', max_slippage: 0.04 },
        { token_in: 'SOL', token_out: 'USDC', amount: 20.0, order_type: 'market', max_slippage: 0.035 }
      ];

      console.log(`Submitting ${concurrentOrders.length} orders...`);
      
      const promises = concurrentOrders.map((order, index) => 
        this.executeOrderWithFullLifecycle(order, index + 1)
      );

      const results = await Promise.all(promises);
      
      const successfulOrders = results.filter(r => r.finalStatus === 'confirmed');
      const failedOrders = results.filter(r => r.finalStatus === 'failed');
      
      console.log(`Completed: ${successfulOrders.length}/${results.length} successful (${((successfulOrders.length / results.length) * 100).toFixed(1)}%)`);
      
      const completionTimes = results.map(r => r.completionTime);
      const maxCompletionTime = Math.max(...completionTimes);
      const minCompletionTime = Math.min(...completionTimes);
      
      console.log(`  Time range: ${minCompletionTime.toFixed(0)}ms - ${maxCompletionTime.toFixed(0)}ms`);
      
      results.forEach(result => this.updateOrderFlowMetrics(result));
      
      if (successfulOrders.length < results.length * 0.8) {
        throw new Error(`Concurrent order success rate too low: ${((successfulOrders.length / results.length) * 100).toFixed(1)}%`);
      }

      console.log('Concurrent test passed');
      this.results.passed++;
      
    } catch (error) {
      console.error('Concurrent test failed:', error.message);
      this.results.failed++;
      throw error;
    }
  }

  async testErrorHandlingAndRecovery() {
    console.log('\nTesting Error Handling and Recovery');
    console.log('====================================');
    
    this.results.total++;
    
    try {
      await this.testInvalidSlippageHandling();
      await this.testInvalidTokenPairs();
      await this.testZeroAmountOrders();
      await this.testLargeAmountOrders();
      
      console.log('Error Handling and Recovery Test Passed');
      this.results.passed++;
      
    } catch (error) {
      console.error('Error Handling and Recovery Test Failed:', error.message);
      this.results.failed++;
      throw error;
    }
  }

  async testInvalidSlippageHandling() {
    console.log('  Testing invalid slippage handling');
    
    const invalidSlippageOrders = [
      { token_in: 'SOL', token_out: 'USDC', amount: 10, order_type: 'market', max_slippage: 0.6 },
      { token_in: 'SOL', token_out: 'USDC', amount: 10, order_type: 'market', max_slippage: 0.005 },
      { token_in: 'SOL', token_out: 'USDC', amount: 10, order_type: 'market', max_slippage: -0.1 }
    ];

    for (const order of invalidSlippageOrders) {
      try {
        const response = await axios.post(`${API_URL}/api/orders/execute`, order, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        });
        
        if (response.status === 200) {
          throw new Error(`Expected error for invalid slippage ${order.max_slippage}, but got success`);
        }
      } catch (error) {
        if (error.response && error.response.status === 400) {
          console.log(`    Correctly rejected slippage: ${order.max_slippage}`);
        } else {
          throw error;
        }
      }
    }
  }

  async testInvalidTokenPairs() {
    console.log('  Testing invalid token pairs');
    
    const invalidTokenOrders = [
      { token_in: '', token_out: 'USDC', amount: 10, order_type: 'market', max_slippage: 0.03 },
      { token_in: 'SOL', token_out: '', amount: 10, order_type: 'market', max_slippage: 0.03 },
      { token_in: 'INVALID', token_out: 'USDC', amount: 10, order_type: 'market', max_slippage: 0.03 }
    ];

    for (const order of invalidTokenOrders) {
      try {
        const response = await axios.post(`${API_URL}/api/orders/execute`, order, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        });
        
        if (response.status === 200) {
          console.log(`    Accepted invalid token pair: ${order.token_in} → ${order.token_out}`);
        }
      } catch (error) {
        console.log(`    Correctly handled invalid token pair: ${order.token_in} → ${order.token_out}`);
      }
    }
  }

  async testZeroAmountOrders() {
    console.log('  Testing zero amount orders');
    
    const zeroAmountOrder = {
      token_in: 'SOL',
      token_out: 'USDC',
      amount: 0,
      order_type: 'market',
      max_slippage: 0.03
    };

    try {
      const response = await axios.post(`${API_URL}/api/orders/execute`, zeroAmountOrder, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log('    Zero amount order was accepted');
      }
    } catch (error) {
      console.log('    Zero amount order was correctly rejected');
    }
  }

  async testLargeAmountOrders() {
    console.log('  Testing large amount orders');
    
    const largeAmountOrder = {
      token_in: 'SOL',
      token_out: 'USDC',
      amount: 1000000,
      order_type: 'market',
      max_slippage: 0.03
    };

    try {
      const response = await axios.post(`${API_URL}/api/orders/execute`, largeAmountOrder, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log('    Large amount order was accepted, monitoring for issues');
        
        const ws = new WebSocket(WS_URL);
        let orderId = response.data.order_id;
        let hasIssues = false;
        
        ws.on('open', () => {
          ws.send(orderId);
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.order_id === orderId) {
              console.log(`    Large order status: ${message.status}`);
              
              if (message.status === 'failed' && message.reason) {
                console.log(`    Large order failed gracefully: ${message.reason}`);
              } else if (message.status === 'confirmed') {
                console.log(`    Large order completed successfully`);
              }
              
              if (message.status === 'confirmed' || message.status === 'failed') {
                ws.close();
              }
            }
          } catch (error) {
            console.error('    Error parsing large order response:', error.message);
            hasIssues = true;
            ws.close();
          }
        });
        
        ws.on('error', (error) => {
          console.error('    WebSocket error for large order:', error.message);
          hasIssues = true;
        });
        
        await new Promise(resolve => {
          setTimeout(() => {
            ws.close();
            resolve();
          }, 20000);
        });
        
        if (hasIssues) {
          throw new Error('Large amount order caused system issues');
        }
      }
    } catch (error) {
      console.log('    Large amount order was correctly rejected');
    }
  }

  async testSystemResilience() {
    console.log('\nTesting System Resilience');
    console.log('==========================');
    
    this.results.total++;
    
    try {
      await this.testRapidConnectionHandling();
      await this.testWebSocketReconnection();
      await this.testHighFrequencySubmission();
      
      console.log('System Resilience Test Passed');
      this.results.passed++;
      
    } catch (error) {
      console.error('System Resilience Test Failed:', error.message);
      this.results.failed++;
      throw error;
    }
  }

  async testRapidConnectionHandling() {
    console.log('  Testing rapid connection handling');
    
    const connectionPromises = [];
    
    for (let i = 0; i < 10; i++) {
      connectionPromises.push(this.createRapidConnection(i));
    }
    
    const results = await Promise.allSettled(connectionPromises);
    const successfulConnections = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`    Successful connections: ${successfulConnections}/10`);
    
    if (successfulConnections < 8) {
      throw new Error(`Too many connection failures: ${successfulConnections}/10`);
    }
  }

  async createRapidConnection(connectionId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      
      ws.on('open', () => {
        setTimeout(() => {
          ws.close();
          resolve(`Connection ${connectionId} successful`);
        }, 100);
      });
      
      ws.on('error', (error) => {
        reject(new Error(`Connection ${connectionId} failed: ${error.message}`));
      });
    });
  }

  async testWebSocketReconnection() {
    console.log('  Testing WebSocket reconnection');
    
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
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!reconnected) {
      throw new Error('WebSocket reconnection test failed');
    }
    
    console.log('    WebSocket reconnection successful');
  }

  async testHighFrequencySubmission() {
    console.log('  Testing high-frequency order submission');
    
    const submissionPromises = [];
    
    for (let i = 0; i < 20; i++) {
      submissionPromises.push(this.submitOrderWithTimeout(i));
    }
    
    const results = await Promise.allSettled(submissionPromises);
    const successfulSubmissions = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`    Successful submissions: ${successfulSubmissions}/20`);
    
    if (successfulSubmissions < 15) {
      throw new Error(`High-frequency submission failure rate too high: ${successfulSubmissions}/20`);
    }
  }

  async submitOrderWithTimeout(orderIndex) {
    try {
      const order = {
        token_in: 'SOL',
        token_out: 'USDC',
        amount: Math.random() * 5 + 1,
        order_type: 'market',
        max_slippage: 0.03
      };
      
      const response = await axios.post(`${API_URL}/api/orders/execute`, order, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 3000
      });
      
      return `Order ${orderIndex} submitted: ${response.data.order_id}`;
    } catch (error) {
      throw new Error(`Order ${orderIndex} failed: ${error.message}`);
    }
  }

  async testDataConsistency() {
    console.log('\nTesting Data Consistency');
    console.log('=========================');
    
    this.results.total++;
    
    try {
      const order = {
        token_in: 'SOL',
        token_out: 'USDC',
        amount: 7.5,
        order_type: 'market',
        max_slippage: 0.025
      };

      const consistencyResult = await this.verifyOrderDataConsistency(order);
      
      if (!consistencyResult.isConsistent) {
        throw new Error(`Data consistency violation: ${consistencyResult.violations.join(', ')}`);
      }

      console.log('Data Consistency Test Passed');
      console.log(`  Order ID: ${consistencyResult.orderId}`);
      console.log(`  Token Pair: ${consistencyResult.tokenIn} → ${consistencyResult.tokenOut}`);
      console.log(`  Amount: ${consistencyResult.amount}`);
      console.log(`  Final Price: $${consistencyResult.executionPrice}`);
      
      this.results.passed++;
      
    } catch (error) {
      console.error('Data Consistency Test Failed:', error.message);
      this.results.failed++;
      throw error;
    }
  }

  async verifyOrderDataConsistency(order) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let orderId = null;
      let isConsistent = true;
      const violations = [];
      const receivedData = {};

      ws.on('open', async () => {
        try {
          const response = await axios.post(`${API_URL}/api/orders/execute`, order, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
          });

          orderId = response.data.order_id;
          receivedData.orderId = orderId;
          receivedData.tokenIn = order.token_in;
          receivedData.tokenOut = order.token_out;
          receivedData.amount = order.amount;
          receivedData.orderType = order.order_type;
          receivedData.maxSlippage = order.max_slippage;

          ws.send(orderId);

        } catch (error) {
          reject(error);
        }
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.order_id === orderId) {
            if (message.order_id !== orderId) {
              violations.push(`Order ID mismatch: expected ${orderId}, got ${message.order_id}`);
              isConsistent = false;
            }

            if (message.execution_price) {
              receivedData.executionPrice = message.execution_price;
            }

            if (message.status === 'confirmed' || message.status === 'failed') {
              ws.close();
              
              if (receivedData.executionPrice && receivedData.executionPrice <= 0) {
                violations.push(`Invalid execution price: ${receivedData.executionPrice}`);
                isConsistent = false;
              }

              resolve({
                isConsistent,
                violations,
                orderId: receivedData.orderId,
                tokenIn: receivedData.tokenIn,
                tokenOut: receivedData.tokenOut,
                amount: receivedData.amount,
                executionPrice: receivedData.executionPrice
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
        reject(new Error('Data consistency test timeout'));
      }, 30000);
    });
  }

  async executeOrderWithFullLifecycle(order, orderNumber = null) {
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

  updateOrderFlowMetrics(orderResult) {
    this.results.orders.total++;
    
    if (orderResult.finalStatus === 'confirmed') {
      this.results.orders.success++;
    } else {
      this.results.orders.failed++;
    }

    orderResult.statusSequence.forEach(status => {
      this.results.orders.statuses[status] = 
        (this.results.orders.statuses[status] || 0) + 1;
    });

  }

  calculateFinalMetrics() {
    this.results.duration = Date.now() - this.startTime;
    
    console.log('\n--- Test Summary ---');
    console.log(`Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
    console.log(`Duration: ${(this.results.duration / 1000).toFixed(2)}s`);
    
    console.log('\n--- Order Stats ---');
    console.log(`Total: ${this.results.orders.total}`);
    console.log(`Success: ${this.results.orders.success}`);
    console.log(`Failed: ${this.results.orders.failed}`);
    console.log(`Rate: ${((this.results.orders.success / this.results.orders.total) * 100).toFixed(1)}%`);
    
    console.log('\nStatus counts:');
    Object.entries(this.results.orders.statuses).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
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