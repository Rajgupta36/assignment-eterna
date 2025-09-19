#!/usr/bin/env node

import { runAcknowledgmentTests } from './acknowledgment-tests.js';
import { runIntegrationTests } from './integration-tests.js';

class TestRunner {
  constructor() {
    this.testSuites = [
      { name: 'Acknowledgment Tests', runner: runAcknowledgmentTests },
      { name: 'Integration Tests', runner: runIntegrationTests }
    ];
    
    this.results = {
      totalSuites: 0,
      passedSuites: 0,
      failedSuites: 0,
      startTime: null,
      endTime: null,
      suiteResults: []
    };
  }

  async runAllTests() {
    console.log('Starting Comprehensive Test Suite');
    console.log('==================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test Suites: ${this.testSuites.length}`);
    console.log('');
    
    this.results.startTime = Date.now();
    this.results.totalSuites = this.testSuites.length;
    
    for (const [index, suite] of this.testSuites.entries()) {
      console.log(`\nRunning Test Suite ${index + 1}/${this.testSuites.length}: ${suite.name}`);
      console.log('='.repeat(60));
      
      const suiteStartTime = Date.now();
      
      try {
        await suite.runner();
        
        const suiteEndTime = Date.now();
        const suiteDuration = suiteEndTime - suiteStartTime;
        
        console.log(`\n${suite.name} completed successfully in ${(suiteDuration / 1000).toFixed(2)}s`);
        
        this.results.passedSuites++;
        this.results.suiteResults.push({
          name: suite.name,
          status: 'PASSED',
          duration: suiteDuration,
          startTime: suiteStartTime,
          endTime: suiteEndTime
        });
        
      } catch (error) {
        const suiteEndTime = Date.now();
        const suiteDuration = suiteEndTime - suiteStartTime;
        
        console.error(`\n${suite.name} failed after ${(suiteDuration / 1000).toFixed(2)}s: ${error.message}`);
        
        this.results.failedSuites++;
        this.results.suiteResults.push({
          name: suite.name,
          status: 'FAILED',
          duration: suiteDuration,
          startTime: suiteStartTime,
          endTime: suiteEndTime,
          error: error.message
        });
      }
      
      if (index < this.testSuites.length - 1) {
        console.log('\nWaiting 5 seconds before next test suite...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    this.results.endTime = Date.now();
    this.printFinalResults();
  }

  async runSpecificTest(testName) {
    const suite = this.testSuites.find(s => 
      s.name.toLowerCase().includes(testName.toLowerCase())
    );
    
    if (!suite) {
      console.error(`Test suite "${testName}" not found`);
      console.log('Available test suites:');
      this.testSuites.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.name}`);
      });
      process.exit(1);
    }
    
    console.log(`Running Specific Test Suite: ${suite.name}`);
    console.log('==========================================');
    
    try {
      await suite.runner();
      console.log(`\n${suite.name} completed successfully!`);
    } catch (error) {
      console.error(`\n${suite.name} failed: ${error.message}`);
      process.exit(1);
    }
  }

  printFinalResults() {
    const totalDuration = this.results.endTime - this.results.startTime;
    
    console.log('\nFinal Test Results Summary');
    console.log('===========================');
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Test Suites: ${this.results.totalSuites}`);
    console.log(`Passed: ${this.results.passedSuites}`);
    console.log(`Failed: ${this.results.failedSuites}`);
    console.log(`Success Rate: ${((this.results.passedSuites / this.results.totalSuites) * 100).toFixed(1)}%`);
    
    console.log('\nIndividual Test Suite Results:');
    console.log('-------------------------------');
    
    this.results.suiteResults.forEach((result, index) => {
      const status = result.status === 'PASSED' ? 'PASS' : 'FAIL';
      const duration = (result.duration / 1000).toFixed(2);
      
      console.log(`${status} ${index + 1}. ${result.name}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Status: ${result.status}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log('');
    });
    
    if (this.results.failedSuites === 0) {
      console.log('All test suites passed successfully!');
      console.log('System is functioning correctly and ready for production.');
    } else if (this.results.failedSuites < this.results.totalSuites) {
      console.log('Some test suites failed. Please review the errors above.');
      console.log('System may have partial functionality issues.');
    } else {
      console.log('All test suites failed. System requires immediate attention.');
      console.log('Critical issues detected - system not ready for production.');
    }
    
    const averageSuiteDuration = this.results.suiteResults.reduce((sum, result) => sum + result.duration, 0) / this.results.suiteResults.length;
    console.log(`\nPerformance Summary:`);
    console.log(`   Average Suite Duration: ${(averageSuiteDuration / 1000).toFixed(2)}s`);
    console.log(`   Fastest Suite: ${this.getFastestSuite()}`);
    console.log(`   Slowest Suite: ${this.getSlowestSuite()}`);
    
    if (this.results.failedSuites > 0) {
      process.exit(1);
    }
  }

  getFastestSuite() {
    const fastest = this.results.suiteResults.reduce((min, result) => 
      result.duration < min.duration ? result : min
    );
    return `${fastest.name} (${(fastest.duration / 1000).toFixed(2)}s)`;
  }

  getSlowestSuite() {
    const slowest = this.results.suiteResults.reduce((max, result) => 
      result.duration > max.duration ? result : max
    );
    return `${slowest.name} (${(slowest.duration / 1000).toFixed(2)}s)`;
  }

  printHelp() {
    console.log('Order Execution Engine Test Runner');
    console.log('=====================================');
    console.log('');
    console.log('Usage:');
    console.log('  node test-runner.js                    # Run all test suites');
    console.log('  node test-runner.js <test-name>        # Run specific test suite');
    console.log('  node test-runner.js --help             # Show this help');
    console.log('');
    console.log('Available test suites:');
    this.testSuites.forEach((suite, index) => {
      console.log(`  ${index + 1}. ${suite.name}`);
    });
    console.log('');
    console.log('Examples:');
    console.log('  node test-runner.js acknowledgment     # Run acknowledgment tests');
    console.log('  node test-runner.js integration        # Run integration tests');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const testRunner = new TestRunner();
  
  if (args.includes('--help') || args.includes('-h')) {
    testRunner.printHelp();
    return;
  }
  
  if (args.length === 0) {
    await testRunner.runAllTests();
  } else if (args.length === 1) {
    await testRunner.runSpecificTest(args[0]);
  } else {
    await testRunner.runAllTests();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Test runner failed:', error.message);
    process.exit(1);
  });
}

export { TestRunner, main };