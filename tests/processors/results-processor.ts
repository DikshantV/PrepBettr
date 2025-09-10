/**
 * Custom Jest Results Processor
 * 
 * Processes test results and generates custom metrics
 */

import { AggregatedResult } from '@jest/test-result';
import * as fs from 'fs';
import * as path from 'path';

export default function resultsProcessor(results: AggregatedResult): AggregatedResult {
  // Generate custom metrics
  const metrics = {
    timestamp: new Date().toISOString(),
    totalTests: results.numTotalTests,
    passedTests: results.numPassedTests,
    failedTests: results.numFailedTests,
    duration: results.testResults.reduce((sum, result) => sum + (result.perfStats.end - result.perfStats.start), 0),
    coverage: results.coverageMap ? {
      statements: results.coverageMap.getCoverageSummary().statements.pct,
      branches: results.coverageMap.getCoverageSummary().branches.pct,
      functions: results.coverageMap.getCoverageSummary().functions.pct,
      lines: results.coverageMap.getCoverageSummary().lines.pct
    } : null,
    slowestTests: results.testResults
      .map(result => ({
        path: result.testFilePath,
        duration: result.perfStats.end - result.perfStats.start
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
  };

  // Write metrics to coverage directory
  const metricsPath = path.join(process.cwd(), 'coverage', 'test-metrics.json');
  try {
    fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.warn('Failed to write test metrics:', error);
  }

  return results;
}
