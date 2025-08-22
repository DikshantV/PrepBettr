/**
 * Performance Baseline Setup for Regression Testing
 * 
 * Establishes performance benchmarks and monitors for regressions across
 * all critical PrepBettr operations in the Azure-centric architecture.
 * 
 * @version 2.0.0
 */

import { performance } from 'perf_hooks';

// ===== PERFORMANCE BASELINES =====

export const PERFORMANCE_BASELINES = {
  // Authentication operations (ms)
  auth: {
    tokenVerification: 50,      // Target: <50ms P95
    sessionCreation: 100,       // Target: <100ms P95
    permissionCheck: 30,        // Target: <30ms P95
    firebaseAuth: 200          // Current Firebase baseline
  },

  // Azure services (ms)
  cosmos: {
    singleRead: 25,            // Target: <25ms P95
    singleWrite: 50,           // Target: <50ms P95
    query: 100,                // Target: <100ms P95
    bulkOperation: 500         // Target: <500ms P95
  },

  blob: {
    upload: 200,               // Target: <200ms for 1MB
    download: 150,             // Target: <150ms for 1MB
    sasGeneration: 10          // Target: <10ms P95
  },

  speech: {
    synthesis: 800,            // Target: <800ms for 100 words
    recognition: 1000,         // Target: <1s for 10s audio
    streamingLatency: 200      // Target: <200ms streaming delay
  },

  openai: {
    chatCompletion: 2000,      // Target: <2s for typical response
    questionGeneration: 3000,  // Target: <3s for interview questions
    tokenProcessing: 100       // Target: <100ms per 1000 tokens
  },

  signalr: {
    connectionSetup: 500,      // Target: <500ms connection time
    messageDelivery: 50,       // Target: <50ms message latency
    groupOperations: 100       // Target: <100ms group add/remove
  },

  // Business operations (ms)
  interview: {
    sessionStart: 1000,        // Target: <1s complete setup
    questionFlow: 3000,        // Target: <3s per Q&A cycle
    sessionEnd: 500            // Target: <500ms cleanup
  },

  // Function cold starts (ms)
  functions: {
    authFunction: 2000,        // Target: <2s cold start
    voiceFunction: 3000,       // Target: <3s cold start
    dataFunction: 1500         // Target: <1.5s cold start
  }
};

// ===== PERFORMANCE MONITORING =====

class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();
  private benchmarks: Map<string, number> = new Map();

  /**
   * Start measuring an operation
   */
  startMeasurement(operationName: string): () => number {
    const startTime = performance.now();
    
    return (): number => {
      const duration = performance.now() - startTime;
      this.recordMeasurement(operationName, duration);
      return duration;
    };
  }

  /**
   * Record a measurement
   */
  recordMeasurement(operationName: string, duration: number): void {
    if (!this.measurements.has(operationName)) {
      this.measurements.set(operationName, []);
    }
    this.measurements.get(operationName)!.push(duration);
  }

  /**
   * Set baseline for an operation
   */
  setBaseline(operationName: string, baselineMs: number): void {
    this.benchmarks.set(operationName, baselineMs);
  }

  /**
   * Get baseline for an operation
   */
  getBaseline(operationName: string): number | undefined {
    return this.benchmarks.get(operationName);
  }

  /**
   * Get performance statistics
   */
  getStats(operationName: string): {
    count: number;
    average: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  } | null {
    const measurements = this.measurements.get(operationName);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      count,
      average: sorted.reduce((sum, val) => sum + val, 0) / count,
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
      min: sorted[0],
      max: sorted[count - 1]
    };
  }

  /**
   * Check for performance regressions
   */
  checkRegression(operationName: string, thresholdPercent = 20): {
    hasRegression: boolean;
    baseline: number;
    current: number;
    regressionPercent: number;
  } | null {
    const baseline = this.benchmarks.get(operationName);
    const stats = this.getStats(operationName);

    if (!baseline || !stats) {
      return null;
    }

    const current = stats.p95;
    const regressionPercent = ((current - baseline) / baseline) * 100;
    const hasRegression = regressionPercent > thresholdPercent;

    return {
      hasRegression,
      baseline,
      current,
      regressionPercent
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    let report = '=== Performance Report ===\\n\\n';

    for (const [operation, _] of this.measurements) {
      const stats = this.getStats(operation);
      const regression = this.checkRegression(operation);

      if (stats) {
        report += `${operation}:\\n`;
        report += `  Count: ${stats.count}\\n`;
        report += `  Average: ${stats.average.toFixed(2)}ms\\n`;
        report += `  P95: ${stats.p95.toFixed(2)}ms\\n`;
        
        if (regression) {
          const status = regression.hasRegression ? '❌ REGRESSION' : '✅ OK';
          report += `  Baseline: ${regression.baseline}ms\\n`;
          report += `  Change: ${regression.regressionPercent.toFixed(1)}% ${status}\\n`;
        }
        
        report += '\\n';
      }
    }

    return report;
  }

  /**
   * Reset all measurements
   */
  reset(): void {
    this.measurements.clear();
  }
}

// ===== GLOBAL INSTANCE =====

export const performanceMonitor = new PerformanceMonitor();

// ===== SETUP BASELINES =====

export function setupPerformanceBaselines(): void {
  // Authentication baselines
  performanceMonitor.setBaseline('auth.tokenVerification', PERFORMANCE_BASELINES.auth.tokenVerification);
  performanceMonitor.setBaseline('auth.sessionCreation', PERFORMANCE_BASELINES.auth.sessionCreation);
  performanceMonitor.setBaseline('auth.permissionCheck', PERFORMANCE_BASELINES.auth.permissionCheck);

  // Cosmos DB baselines
  performanceMonitor.setBaseline('cosmos.singleRead', PERFORMANCE_BASELINES.cosmos.singleRead);
  performanceMonitor.setBaseline('cosmos.singleWrite', PERFORMANCE_BASELINES.cosmos.singleWrite);
  performanceMonitor.setBaseline('cosmos.query', PERFORMANCE_BASELINES.cosmos.query);

  // Blob Storage baselines
  performanceMonitor.setBaseline('blob.upload', PERFORMANCE_BASELINES.blob.upload);
  performanceMonitor.setBaseline('blob.download', PERFORMANCE_BASELINES.blob.download);
  performanceMonitor.setBaseline('blob.sasGeneration', PERFORMANCE_BASELINES.blob.sasGeneration);

  // Speech service baselines
  performanceMonitor.setBaseline('speech.synthesis', PERFORMANCE_BASELINES.speech.synthesis);
  performanceMonitor.setBaseline('speech.recognition', PERFORMANCE_BASELINES.speech.recognition);

  // OpenAI baselines
  performanceMonitor.setBaseline('openai.chatCompletion', PERFORMANCE_BASELINES.openai.chatCompletion);
  performanceMonitor.setBaseline('openai.questionGeneration', PERFORMANCE_BASELINES.openai.questionGeneration);

  // SignalR baselines
  performanceMonitor.setBaseline('signalr.connectionSetup', PERFORMANCE_BASELINES.signalr.connectionSetup);
  performanceMonitor.setBaseline('signalr.messageDelivery', PERFORMANCE_BASELINES.signalr.messageDelivery);

  // Business operation baselines
  performanceMonitor.setBaseline('interview.sessionStart', PERFORMANCE_BASELINES.interview.sessionStart);
  performanceMonitor.setBaseline('interview.questionFlow', PERFORMANCE_BASELINES.interview.questionFlow);

  // Function cold start baselines
  performanceMonitor.setBaseline('functions.authFunction', PERFORMANCE_BASELINES.functions.authFunction);
  performanceMonitor.setBaseline('functions.voiceFunction', PERFORMANCE_BASELINES.functions.voiceFunction);
}

// ===== PERFORMANCE DECORATORS =====

/**
 * Decorator to measure function performance
 */
export function measurePerformance(operationName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const endMeasurement = performanceMonitor.startMeasurement(operationName);
      
      try {
        const result = await method.apply(this, args);
        return result;
      } finally {
        endMeasurement();
      }
    };

    return descriptor;
  };
}

/**
 * Function wrapper to measure performance
 */
export function withPerformanceTracking<T extends (...args: any[]) => any>(
  operationName: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const endMeasurement = performanceMonitor.startMeasurement(operationName);
    
    try {
      const result = await fn(...args);
      return result;
    } finally {
      endMeasurement();
    }
  }) as T;
}

// ===== JEST MATCHERS =====

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinPerformanceBounds(operationName: string): R;
      toBeFasterThan(maxMs: number): R;
    }
  }
}

// Custom Jest matchers for performance testing
expect.extend({
  toBeWithinPerformanceBounds(received: number, operationName: string) {
    const baseline = performanceMonitor.getBaseline(operationName);
    
    if (baseline === undefined) {
      return {
        message: () => `No baseline set for operation: ${operationName}`,
        pass: false
      };
    }

    const threshold = baseline * 1.2; // 20% tolerance
    const pass = received <= threshold;

    if (pass) {
      return {
        message: () => `Expected ${received}ms to exceed ${threshold}ms (baseline: ${baseline}ms)`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received}ms to be within 20% of baseline ${baseline}ms (max: ${threshold}ms)`,
        pass: false
      };
    }
  },

  toBeFasterThan(received: number, maxMs: number) {
    const pass = received < maxMs;
    
    if (pass) {
      return {
        message: () => `Expected ${received}ms to be slower than ${maxMs}ms`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received}ms to be faster than ${maxMs}ms`,
        pass: false
      };
    }
  }
});

// ===== PERFORMANCE TESTING UTILITIES =====

export const PerformanceUtils = {
  /**
   * Run performance test with multiple iterations
   */
  async runPerformanceTest(
    operationName: string,
    testFunction: () => Promise<void>,
    iterations = 10
  ): Promise<{
    average: number;
    p95: number;
    allResults: number[];
  }> {
    const results: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await testFunction();
      const duration = performance.now() - start;
      results.push(duration);
      performanceMonitor.recordMeasurement(operationName, duration);
    }

    const sorted = results.sort((a, b) => a - b);
    const average = results.reduce((sum, val) => sum + val, 0) / results.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    return { average, p95, allResults: results };
  },

  /**
   * Simulate load with concurrent operations
   */
  async runLoadTest(
    operationName: string,
    testFunction: () => Promise<void>,
    concurrency = 5,
    duration = 10000 // 10 seconds
  ): Promise<{
    totalOperations: number;
    operationsPerSecond: number;
    averageLatency: number;
    errors: number;
  }> {
    const startTime = Date.now();
    const endTime = startTime + duration;
    const results: Array<{ duration: number; error?: Error }> = [];
    
    const workers = Array.from({ length: concurrency }, async () => {
      while (Date.now() < endTime) {
        const operationStart = performance.now();
        try {
          await testFunction();
          const operationDuration = performance.now() - operationStart;
          results.push({ duration: operationDuration });
          performanceMonitor.recordMeasurement(`${operationName}.load`, operationDuration);
        } catch (error) {
          results.push({ duration: performance.now() - operationStart, error: error as Error });
        }
      }
    });

    await Promise.all(workers);

    const totalOperations = results.length;
    const actualDuration = Date.now() - startTime;
    const operationsPerSecond = (totalOperations * 1000) / actualDuration;
    const successfulResults = results.filter(r => !r.error);
    const averageLatency = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
    const errors = results.filter(r => r.error).length;

    return {
      totalOperations,
      operationsPerSecond,
      averageLatency,
      errors
    };
  }
};

// ===== INITIALIZATION =====

// Set up baselines when this module is imported
setupPerformanceBaselines();

// Global cleanup for tests
beforeEach(() => {
  // Reset measurements before each test
  performanceMonitor.reset();
});

afterAll(() => {
  // Generate final performance report
  const report = performanceMonitor.generateReport();
  if (process.env.PERFORMANCE_REPORT === 'true') {
    console.log(report);
  }
});
