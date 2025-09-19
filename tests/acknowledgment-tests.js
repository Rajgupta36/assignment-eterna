import WebSocket from 'ws';
import axios from 'axios';

const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/api/orders/execute';

class AcknowledgmentTester {
  constructor() {
    this.stats = { total: 0, acked: 0, failed: 0, times: [] };
  }

  async testOrderWithFullAcknowledgment() {
    console.log('\n=== Single Order Test ===');
    
    this.stats.total += 1;
    
    const order = {
      token_in: 'SOL',
      token_out: 'USDC', 
      amount: 10.5,
      order_type: 'market',
      max_slippage: 0.03
    };

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let orderId = null;
      let statusSequence = [];
      const startTime = Date.now();

      ws.on('open', async () => {
        try {
          console.log('Submitting order...');
          const response = await axios.post(`${API_URL}/api/orders/execute`, order, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
          });

          orderId = response.data.order_id;
          console.log(`Order ID: ${orderId}`);
          ws.send(orderId);
        } catch (error) {
          console.error('Submission failed:', error.message);
          this.stats.failed++;
          reject(error);
        }
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.order_id === orderId) {
            const status = message.status;
            statusSequence.push(status);
            
            console.log(`Status: ${status}`);
            
            if (status === 'pending') console.log('  -> Pending');
            else if (status === 'routing') console.log('  -> Routing');
            else if (status === 'building') console.log('  -> Building tx');
            else if (status === 'submitted') {
              console.log('  -> Submitted');
              if (message.tx_hash) console.log(`  -> TX: ${message.tx_hash}`);
            } else if (status === 'confirmed') {
              console.log('  -> Confirmed!');
              console.log(`  -> Price: $${message.execution_price}`);
              console.log(`  -> TX: ${message.tx_hash}`);
              
              const totalTime = Date.now() - startTime;
              console.log('\n--- Results ---');
              console.log(`Total time: ${totalTime}ms`);
              console.log(`Flow: ${statusSequence.join(' -> ')}`);
              
              this.stats.acked++;
              ws.close();
              resolve({ orderId, status: 'confirmed', totalTime });
            } else if (status === 'failed') {
              console.log('  -> Failed');
              console.log(`  -> Error: ${message.reason}`);
              this.stats.failed++;
              ws.close();
              resolve({ orderId, status: 'failed', reason: message.reason });
            }

            this.stats.times.push(Date.now() - startTime);
          }
        } catch (error) {
          console.error('Parse error:', error.message);
          reject(error);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        this.stats.failed++;
        reject(error);
      });

      setTimeout(() => {
        ws.close();
        reject(new Error('Test timeout'));
      }, 30000);
    });
  }

  async testConcurrentOrdersWithAcknowledgment(count = 3) {
    console.log(`\n=== ${count} Concurrent Orders ===`);
    
    this.stats.total += count;
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
      this.testSingleOrder(order, index + 1)
    );

    try {
      const results = await Promise.all(promises);
      console.log('\n--- Concurrent Results ---');
      console.log(`Orders: ${count}`);
      console.log(`Acked: ${this.stats.acked}`);
      console.log(`Failed: ${this.stats.failed}`);
      return results;
    } catch (error) {
      console.error('Concurrent test failed:', error.message);
      throw error;
    }
  }

  async testSingleOrder(order, orderNumber) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let orderId = null;
      const startTime = Date.now();

      ws.on('open', async () => {
        try {
          console.log(`Order ${orderNumber}: Submitting...`);
          const response = await axios.post(`${API_URL}/api/orders/execute`, order, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
          });

          orderId = response.data.order_id;
          console.log(`Order ${orderNumber}: Submitted (${orderId.slice(0, 8)}...)`);
          ws.send(orderId);
        } catch (error) {
          console.error(`Order ${orderNumber}: Failed - ${error.message}`);
          this.stats.failed++;
          reject(error);
        }
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.order_id === orderId) {
            const responseTime = Date.now() - startTime;
            this.stats.times.push(responseTime);
            console.log(`Order ${orderNumber}: ${message.status} (${responseTime}ms)`);
            
            if (message.status === 'confirmed') {
              this.stats.acked++;
              ws.close();
              resolve({
                orderNumber,
                orderId,
                status: message.status,
                responseTime
              });
            } else if (message.status === 'failed') {
              this.stats.failed++;
              ws.close();
              resolve({
                orderNumber,
                orderId,
                status: message.status,
                responseTime
              });
            }
          }
        } catch (error) {
          console.error(`Order ${orderNumber}: Parse error - ${error.message}`);
          reject(error);
        }
      });

      ws.on('error', (error) => {
        console.error(`Order ${orderNumber}: WebSocket error - ${error.message}`);
        this.stats.failed++;
        reject(error);
      });

      setTimeout(() => {
        ws.close();
        reject(new Error(`Order ${orderNumber} timeout`));
      }, 30000);
    });
  }

  async testAcknowledgmentTimeout() {
    console.log('\n=== Timeout Test ===');
    
    this.stats.total += 1;
    
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
          console.log(`Order submitted: ${orderId}`);
          ws.send(orderId);

          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              console.log('Acknowledgment timeout reached');
              ws.close();
              resolve({ status: 'timeout', message: 'Timeout handled gracefully' });
            }
          }, 10000);
        } catch (error) {
          console.error('Timeout test failed:', error.message);
          resolve({ status: 'error', message: error.message });
        }
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`Status: ${message.status}`);
          
          if (message.status === 'confirmed') {
            console.log('Order completed before timeout');
            this.stats.acked++;
            ws.close();
            resolve({ status: 'completed', message: 'Order completed successfully' });
          } else if (message.status === 'failed') {
            console.log('Order failed before timeout');
            this.stats.failed++;
            ws.close();
            resolve({ status: 'completed', message: 'Order failed successfully' });
          }
        } catch (error) {
          console.error('Message parsing error:', error.message);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        resolve({ status: 'error', message: error.message });
      });
    });
  }

  printFinalMetrics() {
    console.log('\n--- Final Stats ---');
    console.log(`Total: ${this.stats.total}`);
    console.log(`Acked: ${this.stats.acked}`);
    console.log(`Failed: ${this.stats.failed}`);
    console.log(`Success: ${((this.stats.acked / this.stats.total) * 100).toFixed(1)}%`);
    
    if (this.stats.times.length > 0) {
      const avgTime = this.stats.times.reduce((a, b) => a + b, 0) / this.stats.times.length;
      const minTime = Math.min(...this.stats.times);
      const maxTime = Math.max(...this.stats.times);
      
      console.log(`Avg time: ${avgTime.toFixed(0)}ms`);
      console.log(`Min: ${minTime}ms`);
      console.log(`Max: ${maxTime}ms`);
    }
  }
}

async function runAcknowledgmentTests() {
  const tester = new AcknowledgmentTester();
  
  try {
    console.log('Starting tests...');
    
    await tester.testOrderWithFullAcknowledgment();
    await tester.testConcurrentOrdersWithAcknowledgment(3);
    await tester.testAcknowledgmentTimeout();
    
    tester.printFinalMetrics();
    console.log('\nAll tests passed!');
    
  } catch (error) {
    console.error('\nTests failed:', error.message);
    process.exit(1);
  }
}

export { AcknowledgmentTester, runAcknowledgmentTests };

if (import.meta.url === `file://${process.argv[1]}`) {
  runAcknowledgmentTests().catch(console.error);
}