/**
 * Custom Jest Performance Reporter
 * 
 * Tracks test performance metrics and provides insights into slow tests
 */

import { Reporter, Test, TestResult } from '@jest/reporters';
import { Config } from '@jest/types';

class PerformanceReporter implements Partial<Reporter> {
  private slowTests: Array<{ name: string; duration: number }> = [];
  private slowTestThreshold = 5000; // 5 seconds

  onTestResult(test: Test, testResult: TestResult): void {
    // Track slow individual tests
    testResult.testResults.forEach(result => {
      if (result.duration && result.duration > 1000) { // 1 second
        this.slowTests.push({
          name: `${test.path}: ${result.ancestorTitles.join(' > ')} > ${result.title}`,
          duration: result.duration
        });
      }
    });
  }

  onRunComplete(): void {
    if (this.slowTests.length > 0) {
      console.log('\n⚠️  Performance Warning: Slow Tests Detected');
      console.log('=' .repeat(60));
      
      // Sort by duration and show top 10
      this.slowTests
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .forEach(test => {
          console.log(`${(test.duration / 1000).toFixed(2)}s - ${test.name}`);
        });
      
      console.log('\n💡 Consider optimizing these tests or using appropriate timeouts.');
    }
  }
}

export default PerformanceReporter;
