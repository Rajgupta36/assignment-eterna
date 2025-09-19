import WebSocket from 'ws';
import axios from 'axios';

const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/api/orders/execute';

class AcknowledgmentTester {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      acknowledgedRequests: 0,
      failedRequests: 0,
      pendingRequests: 0,
      responseTimes: [],
      throughput: {
        requestsPerMinute: 0,
        startTime: null,
        endTime: null
      }
    };
    this.activeOrders = new Map();
  }

  async testOrderWithFullAcknowledgment() {
    console.log('\n Testing Order with Full Acknowledgment Flow');
    console.log('===============================================');

    const order = {
      token_in: 'SOL',
      token_out: 'USDC',
      amount: 10.5,
      order_type: 'market',
      max_slippage: 0.03
    };

    const startTime = Date.now();
    this.metrics.throughput.startTime = startTime;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let orderId = null;
      let acknowledged = false;
      let statusSequence = [];
      let finalAcknowledgment = null;

      ws.on('open', async () => {
        try {
          console.log(' Submitting order...');
          const response = await axios.post(`${API_URL}/api/orders/execute`, order, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
          });

          if (response.status !== 200) {
            throw new Error(`Expected 200 status, got ${response.status}`);
          }

          orderId = response.data.order_id;
          if (!orderId) {
            throw new Error('Missing order_id in response');
          }

          console.log(` Order submitted: ${orderId}`);
          console.log(` Initial status: ${response.data.status}`);
          
          acknowledged = true;
          this.metrics.acknowledgedRequests++;
          
          ws.send(orderId);
          console.log(`Registered for updates: ${orderId}`);
          
        } catch (error) {
          console.error(' Order submission failed:', error.message);
          this.metrics.failedRequests++;
          reject(error);
        }
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.order_id === orderId) {
            const status = message.status;
            statusSequence.push(status);
            
            console.log(` Status Update: ${status}`);
            
            if (status === 'pending') {
              console.log('    ✓ Acknowledged: Order pending processing');
            } else if (status === 'routing') {
              console.log('    ✓ Acknowledged: Routing to best DEX');
            } else if (status === 'building') {
              console.log('    ✓ Acknowledged: Building transaction');
            } else if (status === 'submitted') {
              console.log('    ✓ Acknowledged: Transaction submitted');
              if (message.tx_hash) {
                console.log(`    Transaction Hash: ${message.tx_hash}`);
              }
            } else if (status === 'confirmed') {
              console.log('    ✓ Acknowledged: Order confirmed');
              finalAcknowledgment = {
                orderId,
                txHash: message.tx_hash,
                executionPrice: message.execution_price,
                status: 'confirmed'
              };
              console.log(`    Final Price: $${message.execution_price}`);
              console.log(`    Transaction: ${message.tx_hash}`);
            } else if (status === 'failed') {
              console.log('    ✓ Acknowledged: Order failed');
              finalAcknowledgment = {
                orderId,
                reason: message.reason,
                status: 'failed'
              };
              console.log(`    Reason: ${message.reason}`);
            }

            const responseTime = Date.now() - startTime;
            this.metrics.responseTimes.push(responseTime);

            if (status === 'confirmed' || status === 'failed') {
              const totalTime = Date.now() - startTime;
              this.metrics.throughput.endTime = Date.now();
              
              console.log('\n Acknowledgment Metrics:');
              console.log(`   Total Time: ${totalTime}ms`);
              console.log(`   Status Sequence: ${statusSequence.join(' → ')}`);
              console.log(`   Response Times: ${this.metrics.responseTimes.join('ms, ')}ms`);
              console.log(`   Final Status: ${finalAcknowledgment.status}`);
              
              ws.close();
              resolve(finalAcknowledgment);
            }
          }
        } catch (error) {
          console.error(' Message parsing failed:', error.message);
          reject(error);
        }
      });

      ws.on('error', (error) => {
        console.error(' WebSocket error:', error.message);
        this.metrics.failedRequests++;
        reject(error);
      });

      setTimeout(() => {
        if (!finalAcknowledgment) {
          console.error(' Test timeout - no final acknowledgment received');
          ws.close();
          reject(new Error('Test timeout'));
        }
      }, 30000);
    });
  }

  async testConcurrentOrdersWithAcknowledgment(count = 5) {
    console.log(`\nTesting ${count} Concurrent Orders with Acknowledgment`);
    console.log('=====================================================');

    const startTime = Date.now();
    this.metrics.throughput.startTime = startTime;
    this.metrics.totalRequests = count;

    const orders = [];
    for (let i = 0; i < count; i++) {
      orders.push({
        token_in: 'SOL',
        token_out: 'USDC',
        amount: Math.random() * 20 + 1, 
        order_type: 'market',
        max_slippage: 0.02 + (Math.random() * 0.03) 
      });
    }

    const promises = orders.map((order, index) => 
      this.testSingleOrderWithMetrics(order, index + 1)
    );

    try {
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTimeMs = endTime - startTime;
      const totalTimeMinutes = totalTimeMs / (1000 * 60);
      this.metrics.throughput.requestsPerMinute = count / totalTimeMinutes;
      
      console.log('\n Concurrent Test Results:');
      console.log('============================');
      console.log(`Total Orders: ${count}`);
      console.log(`Acknowledged: ${this.metrics.acknowledgedRequests}`);
      console.log(`Failed: ${this.metrics.failedRequests}`);
      console.log(`Total Time: ${totalTimeMs}ms`);
      console.log(`Throughput: ${this.metrics.throughput.requestsPerMinute.toFixed(2)} orders/minute`);
      console.log(`Average Response Time: ${this.calculateAverageResponseTime()}ms`);
      
      return results;
    } catch (error) {
      console.error(' Concurrent test failed:', error.message);
      throw error;
    }
  }

  async testSingleOrderWithMetrics(order, orderNumber) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let orderId = null;
      let acknowledged = false;
      const startTime = Date.now();

      ws.on('open', async () => {
        try {
          console.log(` Order ${orderNumber}: Submitting...`);
          const response = await axios.post(`${API_URL}/api/orders/execute`, order, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
          });

          orderId = response.data.order_id;
          acknowledged = true;
          this.metrics.acknowledgedRequests++;
          
          console.log(` Order ${orderNumber}: Submitted (${orderId.slice(0, 8)}...)`);
          ws.send(orderId);

        } catch (error) {
          console.error(` Order ${orderNumber}: Failed - ${error.message}`);
          this.metrics.failedRequests++;
          reject(error);
        }
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.order_id === orderId) {
            const responseTime = Date.now() - startTime;
            this.metrics.responseTimes.push(responseTime);
            
            console.log(` Order ${orderNumber}: ${message.status} (${responseTime}ms)`);
            
            if (message.status === 'confirmed' || message.status === 'failed') {
              ws.close();
              resolve({
                orderNumber,
                orderId,
                status: message.status,
                responseTime,
                txHash: message.tx_hash,
                executionPrice: message.execution_price,
                reason: message.reason
              });
            }
          }
        } catch (error) {
          console.error(` Order ${orderNumber}: Parse error - ${error.message}`);
          reject(error);
        }
      });

      ws.on('error', (error) => {
        console.error(` Order ${orderNumber}: WebSocket error - ${error.message}`);
        this.metrics.failedRequests++;
        reject(error);
      });

      setTimeout(() => {
        if (!acknowledged) {
          console.error(` Order ${orderNumber}: Timeout`);
          ws.close();
          reject(new Error(`Order ${orderNumber} timeout`));
        }
      }, 30000);
    });
  }

  calculateAverageResponseTime() {
    if (this.metrics.responseTimes.length === 0) return 0;
    const sum = this.metrics.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.metrics.responseTimes.length);
  }

  async testAcknowledgmentTimeout() {
    console.log('\n Testing Acknowledgment Timeout Scenario');
    console.log('==========================================');

    return new Promise((resolve) => {
      const ws = new WebSocket(WS_URL);
      let acknowledged = false;

      ws.on('open', async () => {
        try {
          const order = {
            token_in: 'SOL',
            token_out: 'USDC',
            amount: 0.001, 
            order_type: 'market',
            max_slippage: 0.01
          };

          const response = await axios.post(`${API_URL}/api/orders/execute`, order, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
          });

          const orderId = response.data.order_id;
          acknowledged = true;
          
          console.log(` Order submitted: ${orderId}`);
          ws.send(orderId);

          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              console.log(' Acknowledgment timeout reached');
              ws.close();
              resolve({
                status: 'timeout',
                message: 'Acknowledgment timeout handled gracefully'
              });
            }
          }, 10000); 

        } catch (error) {
          console.error(' Timeout test failed:', error.message);
          resolve({
            status: 'error',
            message: error.message
          });
        }
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(` Status: ${message.status}`);
          
          if (message.status === 'confirmed' || message.status === 'failed') {
            console.log(' Order completed before timeout');
            ws.close();
            resolve({
              status: 'completed',
              message: 'Order completed successfully'
            });
          }
        } catch (error) {
          console.error(' Message parsing error:', error.message);
        }
      });

      ws.on('error', (error) => {
        console.error(' WebSocket error:', error.message);
        resolve({
          status: 'error',
          message: error.message
        });
      });
    });
  }

  printFinalMetrics() {
    console.log('\n Final Acknowledgment Test Metrics');
    console.log('=====================================');
    console.log(`Total Requests: ${this.metrics.totalRequests}`);
    console.log(`Acknowledged: ${this.metrics.acknowledgedRequests}`);
    console.log(`Failed: ${this.metrics.failedRequests}`);
    console.log(`Success Rate: ${((this.metrics.acknowledgedRequests / this.metrics.totalRequests) * 100).toFixed(1)}%`);
    
    if (this.metrics.throughput.startTime && this.metrics.throughput.endTime) {
      const totalTime = (this.metrics.throughput.endTime - this.metrics.throughput.startTime) / 1000;
      console.log(`Total Test Time: ${totalTime.toFixed(2)}s`);
      console.log(`Throughput: ${this.metrics.throughput.requestsPerMinute.toFixed(2)} requests/minute`);
    }
    
    if (this.metrics.responseTimes.length > 0) {
      const avgResponseTime = this.calculateAverageResponseTime();
      const minResponseTime = Math.min(...this.metrics.responseTimes);
      const maxResponseTime = Math.max(...this.metrics.responseTimes);
      
      console.log(`Average Response Time: ${avgResponseTime}ms`);
      console.log(`Min Response Time: ${minResponseTime}ms`);
      console.log(`Max Response Time: ${maxResponseTime}ms`);
    }
  }
}

async function runAcknowledgmentTests() {
  const tester = new AcknowledgmentTester();
  
  try {
    console.log(' Starting Acknowledgment Tests');
    console.log('=================================');
    
    await tester.testOrderWithFullAcknowledgment();
    
    await tester.testConcurrentOrdersWithAcknowledgment(3);
    
    await tester.testAcknowledgmentTimeout();
    
    tester.printFinalMetrics();
    
    console.log('\n All acknowledgment tests completed successfully!');
    
  } catch (error) {
    console.error('\n Acknowledgment tests failed:', error.message);
    process.exit(1);
  }
}

export { AcknowledgmentTester, runAcknowledgmentTests };

if (import.meta.url === `file://${process.argv[1]}`) {
  runAcknowledgmentTests().catch(console.error);
}
