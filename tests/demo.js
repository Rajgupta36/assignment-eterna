#!/usr/bin/env node

import { AcknowledgmentTester } from './acknowledgment-tests.js';
import { PerformanceMetricsTester } from './performance-metrics-tests.js';

/**
 * Demonstration script showing acknowledgment handling and request/min metrics
 * This script demonstrates the key features of the test suite:
 * 1. Proper acknowledgment handling (not just send and wait)
 * 2. Request/min metrics calculation
 * 3. Performance monitoring with detailed metrics
 */

async function runDemo() {
  console.log(' Order Execution Engine Test Demo');
  console.log('===================================');
  console.log('This demo shows acknowledgment handling and request/min metrics');
  console.log('');

  // Demo 1: Acknowledgment Handling
  console.log(' Demo 1: Acknowledgment Handling');
  console.log('==================================');
  console.log('Testing proper acknowledgment of each status update...');
  console.log('');

  const acknowledgmentTester = new AcknowledgmentTester();
  
  try {
    // Test single order with full acknowledgment
    const result = await acknowledgmentTester.testOrderWithFullAcknowledgment();
    
    console.log('');
    console.log(' Demo 1 Complete: Acknowledgment Handling');
    console.log(`   Order Status: ${result.status}`);
    console.log(`   Order ID: ${result.orderId}`);
    if (result.txHash) console.log(`   Transaction: ${result.txHash}`);
    if (result.executionPrice) console.log(`   Execution Price: $${result.executionPrice}`);
    
  } catch (error) {
    console.error(' Demo 1 Failed:', error.message);
  }

  console.log('');
  console.log('⏳ Waiting 3 seconds before next demo...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Demo 2: Request/Min Metrics
  console.log('');
  console.log(' Demo 2: Request/Min Metrics Calculation');
  console.log('==========================================');
  console.log('Testing concurrent orders with request/min tracking...');
  console.log('');

  try {
    // Test concurrent orders to demonstrate request/min calculation
    const concurrentResults = await acknowledgmentTester.testConcurrentOrdersWithAcknowledgment(3);
    
    console.log('');
    console.log(' Demo 2 Complete: Request/Min Metrics');
    console.log(`   Total Orders: ${concurrentResults.length}`);
    console.log(`   Successful Orders: ${concurrentResults.filter(r => r.status === 'confirmed').length}`);
    console.log(`   Failed Orders: ${concurrentResults.filter(r => r.status === 'failed').length}`);
    
    // Calculate and display request/min metrics
    const totalTime = Math.max(...concurrentResults.map(r => r.responseTime));
    const requestsPerMinute = (concurrentResults.length / (totalTime / 60000)).toFixed(2);
    
    console.log(`   Total Time: ${totalTime}ms`);
    console.log(`   Requests Per Minute: ${requestsPerMinute}`);
    
  } catch (error) {
    console.error(' Demo 2 Failed:', error.message);
  }

  console.log('');
  console.log('⏳ Waiting 3 seconds before next demo...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Demo 3: Performance Metrics
  console.log('');
  console.log(' Demo 3: Performance Metrics');
  console.log('==============================');
  console.log('Testing sustained throughput and performance metrics...');
  console.log('');

  const performanceTester = new PerformanceMetricsTester();
  
  try {
    // Run a short performance test
    await performanceTester.testSustainedThroughput(3, 15); // 3 RPS for 15 seconds
    
    console.log('');
    console.log(' Demo 3 Complete: Performance Metrics');
    
  } catch (error) {
    console.error(' Demo 3 Failed:', error.message);
  }

  // Final summary
  console.log('');
  console.log(' Demo Summary');
  console.log('===============');
  console.log(' Acknowledgment Handling: Tests require proper acknowledgment of each status update');
  console.log(' Request/Min Metrics: Calculates throughput in requests per minute');
  console.log(' Performance Monitoring: Tracks response times, success rates, and system metrics');
  console.log('');
  console.log(' Key Features Demonstrated:');
  console.log('   • Not just "send request and wait for response"');
  console.log('   • Proper acknowledgment of each status transition');
  console.log('   • Request/min metrics calculation');
  console.log('   • Performance monitoring with detailed metrics');
  console.log('   • Concurrent order handling');
  console.log('   • Error handling and timeout management');
  console.log('');
  console.log(' For more comprehensive testing, run:');
  console.log('   npm test                    # All test suites');
  console.log('   npm run test:acknowledgment # Acknowledgment tests only');
  console.log('   npm run test:performance    # Performance tests only');
  console.log('   npm run test:integration    # Integration tests only');
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(' Order Execution Engine Test Demo');
  console.log('===================================');
  console.log('');
  console.log('This demo script demonstrates the key features of the test suite:');
  console.log('');
  console.log('1. Acknowledgment Handling');
  console.log('   - Proper acknowledgment of each status update');
  console.log('   - Not just "send request and wait for response"');
  console.log('   - Real-time status tracking with acknowledgment');
  console.log('');
  console.log('2. Request/Min Metrics');
  console.log('   - Calculates requests per minute');
  console.log('   - Tracks throughput over time');
  console.log('   - Monitors concurrent order processing');
  console.log('');
  console.log('3. Performance Metrics');
  console.log('   - Response time tracking');
  console.log('   - Success/failure rates');
  console.log('   - System resource monitoring');
  console.log('');
  console.log('Usage:');
  console.log('  node demo.js              # Run the demo');
  console.log('  node demo.js --help       # Show this help');
  console.log('');
  process.exit(0);
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(error => {
    console.error(' Demo failed:', error.message);
    process.exit(1);
  });
}

export { runDemo };
