#!/usr/bin/env tsx

/**
 * Monitor Mock Interview Usage Script
 * 
 * This script monitors:
 * - Firestore write operations for mock interviews
 * - Azure OpenAI token usage and costs
 * - Feature flag status and rollout progress
 * 
 * Usage:
 *   tsx scripts/monitor-mock-interview-usage.ts
 *   or
 *   npm run monitor:mock-interviews
 */

import { config } from 'dotenv';
import { getAdminFirestore } from '../lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

// Load environment variables
config();

// Configuration
const COLLECTION_NAME = 'mockInterviews';
const METRICS_COLLECTION = 'systemMetrics';
const CHECK_INTERVAL = 60000; // 1 minute
const ALERT_THRESHOLD_WRITES = 100; // Alert if writes exceed this per hour
const ALERT_THRESHOLD_TOKENS = 50000; // Alert if tokens exceed this per hour
const COST_PER_1K_TOKENS = 0.03; // Azure OpenAI pricing (adjust as needed)

interface UsageMetrics {
  timestamp: Date;
  firestoreWrites: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  estimatedCost: number;
  featureFlagStatus: boolean;
  activeUsers: number;
  errorRate: number;
}

interface HourlyStats {
  hour: string;
  writes: number;
  tokens: number;
  cost: number;
  errors: number;
}

class MockInterviewMonitor {
  private db = getAdminFirestore();
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private hourlyStats: Map<string, HourlyStats> = new Map();
  
  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Monitor is already running');
      return;
    }
    
    console.log('🚀 Starting Mock Interview Usage Monitor');
    console.log('==========================================');
    console.log(`📊 Checking every ${CHECK_INTERVAL / 1000} seconds`);
    console.log(`⚠️ Alert thresholds:`);
    console.log(`   - Firestore writes: ${ALERT_THRESHOLD_WRITES}/hour`);
    console.log(`   - Token usage: ${ALERT_THRESHOLD_TOKENS}/hour`);
    console.log('');
    
    this.isRunning = true;
    
    // Initial check
    await this.checkUsage();
    
    // Set up interval
    this.intervalId = setInterval(async () => {
      await this.checkUsage();
    }, CHECK_INTERVAL);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }
  
  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    console.log('\n🛑 Stopping monitor...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    
    // Print final summary
    this.printSummary();
    
    process.exit(0);
  }
  
  /**
   * Check current usage metrics
   */
  private async checkUsage(): Promise<void> {
    try {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 3600000);
      const currentHour = now.toISOString().substring(0, 13);
      
      // Get feature flag status
      const featureFlagStatus = await this.getFeatureFlagStatus();
      
      // Count Firestore writes in the last hour
      const writesSnapshot = await this.db.collection(COLLECTION_NAME)
        .where('createdAt', '>=', hourAgo.toISOString())
        .get();
      
      const firestoreWrites = writesSnapshot.size;
      
      // Calculate token usage from recent interviews
      let totalTokens = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      let errors = 0;
      
      writesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.metadata?.tokenUsage) {
          promptTokens += data.metadata.tokenUsage.prompt || 0;
          completionTokens += data.metadata.tokenUsage.completion || 0;
          totalTokens += data.metadata.tokenUsage.total || 0;
        }
        if (data.metadata?.error) {
          errors++;
        }
      });
      
      // Calculate estimated cost
      const estimatedCost = (totalTokens / 1000) * COST_PER_1K_TOKENS;
      
      // Get active users count
      const activeUsers = await this.getActiveUsersCount(hourAgo);
      
      // Calculate error rate
      const errorRate = firestoreWrites > 0 ? (errors / firestoreWrites) * 100 : 0;
      
      // Create metrics object
      const metrics: UsageMetrics = {
        timestamp: now,
        firestoreWrites,
        tokenUsage: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens
        },
        estimatedCost,
        featureFlagStatus,
        activeUsers,
        errorRate
      };
      
      // Update hourly stats
      if (!this.hourlyStats.has(currentHour)) {
        this.hourlyStats.set(currentHour, {
          hour: currentHour,
          writes: 0,
          tokens: 0,
          cost: 0,
          errors: 0
        });
      }
      
      const hourStats = this.hourlyStats.get(currentHour)!;
      hourStats.writes += firestoreWrites;
      hourStats.tokens += totalTokens;
      hourStats.cost += estimatedCost;
      hourStats.errors += errors;
      
      // Store metrics in Firestore
      await this.storeMetrics(metrics);
      
      // Print current status
      this.printStatus(metrics);
      
      // Check for alerts
      await this.checkAlerts(metrics);
      
    } catch (error) {
      console.error('❌ Error checking usage:', error);
    }
  }
  
  /**
   * Get feature flag status
   */
  private async getFeatureFlagStatus(): Promise<boolean> {
    try {
      // Check environment variable first
      if (process.env.USE_AZURE_MOCK === 'true') {
        return true;
      }
      
      // Check Firestore feature flags collection
      const flagDoc = await this.db.collection('featureFlags').doc('USE_AZURE_MOCK').get();
      
      if (flagDoc.exists) {
        return flagDoc.data()?.enabled === true;
      }
      
      return false;
    } catch (error) {
      console.error('Error getting feature flag status:', error);
      return false;
    }
  }
  
  /**
   * Get count of active users in the time period
   */
  private async getActiveUsersCount(since: Date): Promise<number> {
    try {
      const usersSnapshot = await this.db.collection(COLLECTION_NAME)
        .where('createdAt', '>=', since.toISOString())
        .select('userId')
        .get();
      
      const uniqueUsers = new Set<string>();
      usersSnapshot.forEach(doc => {
        const userId = doc.data().userId;
        if (userId) {
          uniqueUsers.add(userId);
        }
      });
      
      return uniqueUsers.size;
    } catch (error) {
      console.error('Error getting active users count:', error);
      return 0;
    }
  }
  
  /**
   * Store metrics in Firestore for historical tracking
   */
  private async storeMetrics(metrics: UsageMetrics): Promise<void> {
    try {
      await this.db.collection(METRICS_COLLECTION).add({
        ...metrics,
        timestamp: metrics.timestamp.toISOString(),
        type: 'mock-interview-usage'
      });
    } catch (error) {
      console.error('Error storing metrics:', error);
    }
  }
  
  /**
   * Print current status
   */
  private printStatus(metrics: UsageMetrics): void {
    const timestamp = metrics.timestamp.toLocaleTimeString();
    
    console.log(`\n[${timestamp}] Current Status:`);
    console.log(`├─ 🎯 Feature Flag: ${metrics.featureFlagStatus ? '✅ ENABLED' : '⭕ DISABLED'}`);
    console.log(`├─ 📝 Firestore Writes (last hour): ${metrics.firestoreWrites}`);
    console.log(`├─ 🔤 Token Usage: ${metrics.tokenUsage.total.toLocaleString()} (P:${metrics.tokenUsage.prompt.toLocaleString()}, C:${metrics.tokenUsage.completion.toLocaleString()})`);
    console.log(`├─ 💰 Estimated Cost: $${metrics.estimatedCost.toFixed(4)}`);
    console.log(`├─ 👥 Active Users: ${metrics.activeUsers}`);
    console.log(`└─ ❌ Error Rate: ${metrics.errorRate.toFixed(2)}%`);
  }
  
  /**
   * Check for alert conditions
   */
  private async checkAlerts(metrics: UsageMetrics): Promise<void> {
    const alerts: string[] = [];
    
    // Check Firestore writes threshold
    if (metrics.firestoreWrites > ALERT_THRESHOLD_WRITES) {
      alerts.push(`🚨 HIGH FIRESTORE WRITES: ${metrics.firestoreWrites} exceeds threshold of ${ALERT_THRESHOLD_WRITES}/hour`);
    }
    
    // Check token usage threshold
    if (metrics.tokenUsage.total > ALERT_THRESHOLD_TOKENS) {
      alerts.push(`🚨 HIGH TOKEN USAGE: ${metrics.tokenUsage.total} exceeds threshold of ${ALERT_THRESHOLD_TOKENS}/hour`);
    }
    
    // Check error rate
    if (metrics.errorRate > 10) {
      alerts.push(`🚨 HIGH ERROR RATE: ${metrics.errorRate.toFixed(2)}% errors detected`);
    }
    
    // Check cost threshold
    const hourlyRateLimit = 1.0; // $1 per hour
    if (metrics.estimatedCost > hourlyRateLimit) {
      alerts.push(`🚨 HIGH COST: $${metrics.estimatedCost.toFixed(2)}/hour exceeds $${hourlyRateLimit}/hour limit`);
    }
    
    // Print alerts
    if (alerts.length > 0) {
      console.log('\n⚠️ ALERTS:');
      alerts.forEach(alert => console.log(alert));
      
      // Store alerts in Firestore
      await this.storeAlert(alerts, metrics);
      
      // In production, you could send these alerts to:
      // - Slack webhook
      // - Email via AWS SES
      // - Azure Application Insights
      // - PagerDuty
    }
  }
  
  /**
   * Store alert in Firestore
   */
  private async storeAlert(alerts: string[], metrics: UsageMetrics): Promise<void> {
    try {
      await this.db.collection('alerts').add({
        timestamp: metrics.timestamp.toISOString(),
        type: 'mock-interview-usage',
        alerts,
        metrics: {
          firestoreWrites: metrics.firestoreWrites,
          tokenUsage: metrics.tokenUsage.total,
          cost: metrics.estimatedCost,
          errorRate: metrics.errorRate
        },
        resolved: false
      });
    } catch (error) {
      console.error('Error storing alert:', error);
    }
  }
  
  /**
   * Print final summary
   */
  private printSummary(): void {
    console.log('\n==========================================');
    console.log('📊 Monitoring Summary');
    console.log('==========================================');
    
    let totalWrites = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let totalErrors = 0;
    
    // Calculate totals
    this.hourlyStats.forEach(stats => {
      totalWrites += stats.writes;
      totalTokens += stats.tokens;
      totalCost += stats.cost;
      totalErrors += stats.errors;
    });
    
    console.log(`📝 Total Firestore Writes: ${totalWrites}`);
    console.log(`🔤 Total Tokens Used: ${totalTokens.toLocaleString()}`);
    console.log(`💰 Total Estimated Cost: $${totalCost.toFixed(2)}`);
    console.log(`❌ Total Errors: ${totalErrors}`);
    
    // Print hourly breakdown
    if (this.hourlyStats.size > 0) {
      console.log('\n📈 Hourly Breakdown:');
      this.hourlyStats.forEach(stats => {
        console.log(`  ${stats.hour}: ${stats.writes} writes, ${stats.tokens.toLocaleString()} tokens, $${stats.cost.toFixed(4)}`);
      });
    }
  }
  
  /**
   * Get historical metrics for analysis
   */
  async getHistoricalMetrics(hours: number = 24): Promise<void> {
    const since = new Date(Date.now() - hours * 3600000);
    
    const snapshot = await this.db.collection(METRICS_COLLECTION)
      .where('type', '==', 'mock-interview-usage')
      .where('timestamp', '>=', since.toISOString())
      .orderBy('timestamp', 'desc')
      .get();
    
    console.log(`\n📊 Historical Metrics (last ${hours} hours):`);
    console.log('==========================================');
    
    const metrics: UsageMetrics[] = [];
    snapshot.forEach(doc => {
      metrics.push(doc.data() as UsageMetrics);
    });
    
    if (metrics.length === 0) {
      console.log('No historical data available');
      return;
    }
    
    // Calculate aggregates
    const totalWrites = metrics.reduce((sum, m) => sum + m.firestoreWrites, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + m.tokenUsage.total, 0);
    const totalCost = metrics.reduce((sum, m) => sum + m.estimatedCost, 0);
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length;
    
    console.log(`📝 Total Writes: ${totalWrites}`);
    console.log(`🔤 Total Tokens: ${totalTokens.toLocaleString()}`);
    console.log(`💰 Total Cost: $${totalCost.toFixed(2)}`);
    console.log(`❌ Avg Error Rate: ${avgErrorRate.toFixed(2)}%`);
    console.log(`📊 Data Points: ${metrics.length}`);
  }
}

// Main execution
async function main(): Promise<void> {
  const monitor = new MockInterviewMonitor();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--historical')) {
    // Show historical metrics
    const hoursArg = args.find(arg => arg.startsWith('--hours='));
    const hours = hoursArg ? parseInt(hoursArg.split('=')[1]) : 24;
    await monitor.getHistoricalMetrics(hours);
  } else {
    // Start real-time monitoring
    await monitor.start();
  }
}

// Run the monitor
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { MockInterviewMonitor };
