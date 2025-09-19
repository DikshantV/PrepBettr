// lib/subscription-monitoring.js

import { EventEmitter } from 'events';
import subscriptionManager from '@/lib/subscription-manager';

/**
 * Subscription Monitoring and Analytics System
 * Tracks subscription metrics, monitors health, and provides real-time alerts
 */

class SubscriptionMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = new Map();
    this.alerts = new Map();
    this.healthChecks = new Map();
    this.paymentEvents = new Map(); // Store payment history
    this.conversionEvents = new Map(); // Track plan conversions
    
    // Initialize monitoring
    this.initializeMonitoring();
  }

  initializeMonitoring() {
    // Listen to subscription manager events
    subscriptionManager.on('subscription.created', this.onSubscriptionCreated.bind(this));
    subscriptionManager.on('subscription.activated', this.onSubscriptionActivated.bind(this));
    subscriptionManager.on('subscription.cancelled', this.onSubscriptionCancelled.bind(this));
    subscriptionManager.on('subscription.plan_changed', this.onPlanChanged.bind(this));
    subscriptionManager.on('subscription.payment_completed', this.onPaymentCompleted.bind(this));
    subscriptionManager.on('subscription.payment_failed', this.onPaymentFailed.bind(this));
    
    // Initialize metrics
    this.resetDailyMetrics();
    
    // Setup periodic health checks
    this.scheduleHealthChecks();
    
    console.log('Subscription monitoring initialized');
  }

  /**
   * Log successful subscription payment
   */
  logSuccessfulPayment(paymentData) {
    try {
      const paymentEvent = {
        id: this.generateEventId(),
        subscriptionId: paymentData.subscriptionId,
        paymentId: paymentData.paymentId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'USD',
        planId: paymentData.planId,
        billingCycle: paymentData.billingCycle,
        paymentMethod: paymentData.paymentMethod || 'paypal',
        status: 'completed',
        timestamp: new Date(),
        processingTime: paymentData.processingTime,
        metadata: paymentData.metadata || {}
      };

      // Store payment event
      this.paymentEvents.set(paymentEvent.id, paymentEvent);

      // Update metrics
      this.updateMetric('payments_completed_total', 1);
      this.updateMetric('revenue_total', parseFloat(paymentData.amount));
      this.updateMetric(`revenue_${paymentData.planId.toLowerCase()}`, parseFloat(paymentData.amount));

      // Log structured data
      this.logStructuredEvent('payment.completed', paymentEvent);

      // Emit monitoring event
      this.emit('payment.completed', paymentEvent);

      console.log(`Payment completed: ${paymentEvent.paymentId} ($${paymentEvent.amount})`);

    } catch (error) {
      console.error('Error logging successful payment:', error);
    }
  }

  /**
   * Monitor failed payment attempts
   */
  logFailedPayment(paymentData) {
    try {
      const failureEvent = {
        id: this.generateEventId(),
        subscriptionId: paymentData.subscriptionId,
        paymentId: paymentData.paymentId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'USD',
        planId: paymentData.planId,
        failureReason: paymentData.failureReason,
        paymentMethod: paymentData.paymentMethod || 'paypal',
        retryAttempt: paymentData.retryAttempt || 0,
        nextRetryDate: paymentData.nextRetryDate,
        status: 'failed',
        timestamp: new Date(),
        metadata: paymentData.metadata || {}
      };

      // Store failure event
      this.paymentEvents.set(failureEvent.id, failureEvent);

      // Update metrics
      this.updateMetric('payments_failed_total', 1);
      this.updateMetric('payment_failure_rate', this.calculateFailureRate());

      // Log structured data
      this.logStructuredEvent('payment.failed', failureEvent);

      // Check if alert should be triggered
      this.checkPaymentFailureThreshold();

      // Emit monitoring event
      this.emit('payment.failed', failureEvent);

      console.log(`Payment failed: ${failureEvent.subscriptionId} - ${failureEvent.failureReason}`);

    } catch (error) {
      console.error('Error logging failed payment:', error);
    }
  }

  /**
   * Track plan conversion rates
   */
  trackPlanConversion(conversionData) {
    try {
      const conversionEvent = {
        id: this.generateEventId(),
        subscriptionId: conversionData.subscriptionId,
        userId: conversionData.userId,
        fromPlan: conversionData.fromPlan,
        toPlan: conversionData.toPlan,
        conversionType: this.getConversionType(conversionData.fromPlan, conversionData.toPlan),
        prorationAmount: conversionData.prorationAmount || 0,
        effectiveDate: conversionData.effectiveDate || new Date(),
        timestamp: new Date(),
        metadata: conversionData.metadata || {}
      };

      // Store conversion event
      this.conversionEvents.set(conversionEvent.id, conversionEvent);

      // Update conversion metrics
      this.updateMetric(`conversions_${conversionEvent.conversionType}_total`, 1);
      this.updateConversionRates();

      // Log structured data
      this.logStructuredEvent('plan.converted', conversionEvent);

      // Emit monitoring event
      this.emit('plan.converted', conversionEvent);

      console.log(`Plan conversion: ${conversionEvent.fromPlan} → ${conversionEvent.toPlan} (${conversionEvent.conversionType})`);

    } catch (error) {
      console.error('Error tracking plan conversion:', error);
    }
  }

  /**
   * Real-time subscription cancellation alerts
   */
  alertSubscriptionCancellation(cancellationData) {
    try {
      const alert = {
        id: this.generateEventId(),
        type: 'subscription_cancelled',
        severity: this.getCancellationSeverity(cancellationData),
        subscriptionId: cancellationData.subscriptionId,
        userId: cancellationData.userId,
        planId: cancellationData.planId,
        reason: cancellationData.reason,
        churnRisk: this.calculateChurnRisk(cancellationData),
        timestamp: new Date(),
        metadata: cancellationData.metadata || {}
      };

      // Store alert
      this.alerts.set(alert.id, alert);

      // Update churn metrics
      this.updateMetric('cancellations_total', 1);
      this.updateMetric('churn_rate', this.calculateChurnRate());

      // Send alert based on severity
      this.sendAlert(alert);

      // Log structured data
      this.logStructuredEvent('subscription.cancelled', alert);

      // Emit monitoring event
      this.emit('subscription.cancelled', alert);

      console.log(`Subscription cancellation alert: ${alert.subscriptionId} (${alert.severity})`);

    } catch (error) {
      console.error('Error processing cancellation alert:', error);
    }
  }

  /**
   * Get subscription health dashboard data
   */
  async getDashboardData() {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get current metrics
      const metrics = Object.fromEntries(this.metrics.entries());

      // Calculate time-based metrics
      const recentPayments = this.getPaymentsSince(last24Hours);
      const weeklyPayments = this.getPaymentsSince(last7Days);
      const monthlyPayments = this.getPaymentsSince(last30Days);

      const recentFailures = this.getFailedPaymentsSince(last24Hours);
      const weeklyFailures = this.getFailedPaymentsSince(last7Days);

      const recentConversions = this.getConversionsSince(last7Days);

      // Calculate health scores
      const healthScore = this.calculateOverallHealthScore();
      const paymentHealthScore = this.calculatePaymentHealthScore();
      const churnHealthScore = this.calculateChurnHealthScore();

      const dashboardData = {
        // Overall metrics
        healthScore,
        paymentHealthScore,
        churnHealthScore,
        
        // Current totals
        totalSubscriptions: metrics.subscriptions_total || 0,
        activeSubscriptions: metrics.subscriptions_active || 0,
        totalRevenue: metrics.revenue_total || 0,
        
        // Time-based metrics
        last24Hours: {
          payments: recentPayments.length,
          failures: recentFailures.length,
          revenue: recentPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
          failureRate: recentPayments.length > 0 ? recentFailures.length / recentPayments.length : 0
        },
        
        last7Days: {
          payments: weeklyPayments.length,
          failures: weeklyFailures.length,
          conversions: recentConversions.length,
          revenue: weeklyPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
        },
        
        last30Days: {
          payments: monthlyPayments.length,
          revenue: monthlyPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
          churnRate: this.calculateChurnRate(last30Days)
        },
        
        // Plan breakdown
        planBreakdown: this.getPlanBreakdown(),
        
        // Conversion rates
        conversionRates: {
          monthlyToYearly: this.getConversionRate('monthly_to_yearly'),
          individualToEnterprise: this.getConversionRate('individual_to_enterprise'),
          overallUpgrades: this.getConversionRate('upgrade'),
          overallDowngrades: this.getConversionRate('downgrade')
        },
        
        // Recent alerts
        recentAlerts: Array.from(this.alerts.values())
          .filter(alert => alert.timestamp > last24Hours)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10),
          
        // Top failure reasons
        topFailureReasons: this.getTopFailureReasons(last7Days),
        
        // Trends
        trends: {
          subscriptionGrowth: this.calculateGrowthTrend('subscriptions', last30Days),
          revenueGrowth: this.calculateGrowthTrend('revenue', last30Days),
          churnTrend: this.calculateChurnTrend(last30Days)
        },
        
        timestamp: now
      };

      return dashboardData;

    } catch (error) {
      console.error('Error generating dashboard data:', error);
      throw error;
    }
  }

  /**
   * Event handlers for subscription manager events
   */
  onSubscriptionCreated(eventData) {
    this.updateMetric('subscriptions_created_total', 1);
    this.logStructuredEvent('subscription.created', eventData);
  }

  onSubscriptionActivated(eventData) {
    this.updateMetric('subscriptions_active', 1);
    this.updateMetric('subscriptions_total', 1);
    this.logStructuredEvent('subscription.activated', eventData);
  }

  onSubscriptionCancelled(eventData) {
    this.alertSubscriptionCancellation(eventData);
  }

  onPlanChanged(eventData) {
    this.trackPlanConversion(eventData);
  }

  onPaymentCompleted(eventData) {
    this.logSuccessfulPayment(eventData);
  }

  onPaymentFailed(eventData) {
    this.logFailedPayment(eventData);
  }

  /**
   * Helper methods
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  updateMetric(key, value) {
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + value);
  }

  setMetric(key, value) {
    this.metrics.set(key, value);
  }

  getMetric(key) {
    return this.metrics.get(key) || 0;
  }

  logStructuredEvent(eventType, eventData) {
    // Structure the log for external monitoring systems (e.g., Datadog, CloudWatch)
    const structuredLog = {
      timestamp: new Date().toISOString(),
      service: 'subscription-monitoring',
      eventType,
      ...eventData
    };

    // Log to console (replace with your logging system)
    console.log('SUBSCRIPTION_EVENT:', JSON.stringify(structuredLog));

    // TODO: Send to external monitoring system
    // await sendToDatadog(structuredLog);
    // await sendToCloudWatch(structuredLog);
  }

  calculateFailureRate() {
    const totalPayments = this.getMetric('payments_completed_total') + this.getMetric('payments_failed_total');
    const failedPayments = this.getMetric('payments_failed_total');
    return totalPayments > 0 ? failedPayments / totalPayments : 0;
  }

  calculateChurnRate(timeframe = null) {
    // TODO: Implement proper churn rate calculation based on timeframe
    const totalSubscriptions = this.getMetric('subscriptions_total') || 1;
    const cancellations = this.getMetric('cancellations_total') || 0;
    return cancellations / totalSubscriptions;
  }

  getConversionType(fromPlan, toPlan) {
    const fromPlanInfo = this.parsePlanId(fromPlan);
    const toPlanInfo = this.parsePlanId(toPlan);

    if (fromPlanInfo.cycle !== toPlanInfo.cycle) {
      return fromPlanInfo.cycle === 'monthly' ? 'monthly_to_yearly' : 'yearly_to_monthly';
    }

    if (fromPlanInfo.tier !== toPlanInfo.tier) {
      return fromPlanInfo.tier === 'individual' ? 'individual_to_enterprise' : 'enterprise_to_individual';
    }

    return 'lateral';
  }

  parsePlanId(planId) {
    const lower = planId.toLowerCase();
    return {
      tier: lower.includes('individual') ? 'individual' : 'enterprise',
      cycle: lower.includes('monthly') ? 'monthly' : 'yearly'
    };
  }

  getCancellationSeverity(cancellationData) {
    // Determine severity based on plan, user tenure, etc.
    if (cancellationData.planId.includes('ENTERPRISE')) {
      return 'high';
    }
    
    if (cancellationData.reason?.includes('payment')) {
      return 'medium';
    }
    
    return 'low';
  }

  calculateChurnRisk(cancellationData) {
    // Simple churn risk calculation - can be enhanced with ML
    let risk = 0.5; // Base risk
    
    if (cancellationData.planId.includes('ENTERPRISE')) risk += 0.3;
    if (cancellationData.reason?.includes('price')) risk += 0.2;
    if (cancellationData.reason?.includes('competitor')) risk += 0.4;
    
    return Math.min(risk, 1.0);
  }

  getPaymentsSince(date) {
    return Array.from(this.paymentEvents.values())
      .filter(event => event.timestamp > date && event.status === 'completed');
  }

  getFailedPaymentsSince(date) {
    return Array.from(this.paymentEvents.values())
      .filter(event => event.timestamp > date && event.status === 'failed');
  }

  getConversionsSince(date) {
    return Array.from(this.conversionEvents.values())
      .filter(event => event.timestamp > date);
  }

  calculateOverallHealthScore() {
    const paymentHealth = this.calculatePaymentHealthScore();
    const churnHealth = this.calculateChurnHealthScore();
    const growthHealth = this.calculateGrowthHealthScore();
    
    return (paymentHealth + churnHealth + growthHealth) / 3;
  }

  calculatePaymentHealthScore() {
    const failureRate = this.calculateFailureRate();
    return Math.max(0, 1 - (failureRate * 2)); // Convert failure rate to health score
  }

  calculateChurnHealthScore() {
    const churnRate = this.calculateChurnRate();
    return Math.max(0, 1 - (churnRate * 4)); // Convert churn rate to health score
  }

  calculateGrowthHealthScore() {
    // Simplified growth calculation
    const totalSubs = this.getMetric('subscriptions_total');
    const recentSubs = this.getMetric('subscriptions_created_total');
    return totalSubs > 0 ? Math.min(recentSubs / totalSubs, 1) : 0.5;
  }

  getPlanBreakdown() {
    // TODO: Implement plan breakdown from subscription manager
    return {
      individual_monthly: 0,
      individual_yearly: 0,
      enterprise_monthly: 0,
      enterprise_yearly: 0
    };
  }

  getConversionRate(type) {
    const conversions = Array.from(this.conversionEvents.values())
      .filter(event => event.conversionType === type);
    
    const totalConversions = this.conversionEvents.size;
    return totalConversions > 0 ? conversions.length / totalConversions : 0;
  }

  getTopFailureReasons(since) {
    const failures = this.getFailedPaymentsSince(since);
    const reasonCounts = {};
    
    failures.forEach(failure => {
      const reason = failure.failureReason || 'unknown';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    
    return Object.entries(reasonCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));
  }

  calculateGrowthTrend(metric, period) {
    // Simplified trend calculation - would need historical data
    const current = this.getMetric(`${metric}_total`);
    return {
      current,
      trend: 'stable', // 'growing', 'declining', 'stable'
      percentage: 0
    };
  }

  calculateChurnTrend(period) {
    const churnRate = this.calculateChurnRate();
    return {
      current: churnRate,
      trend: 'stable',
      percentage: 0
    };
  }

  updateConversionRates() {
    const totalConversions = this.conversionEvents.size;
    const conversionTypes = ['monthly_to_yearly', 'individual_to_enterprise', 'upgrade', 'downgrade'];
    
    conversionTypes.forEach(type => {
      const rate = this.getConversionRate(type);
      this.setMetric(`conversion_rate_${type}`, rate);
    });
  }

  checkPaymentFailureThreshold() {
    const failureRate = this.calculateFailureRate();
    const threshold = parseFloat(process.env.PAYMENT_FAILURE_THRESHOLD || '0.1');
    
    if (failureRate > threshold) {
      this.sendAlert({
        type: 'high_payment_failure_rate',
        severity: 'high',
        message: `Payment failure rate (${(failureRate * 100).toFixed(1)}%) exceeds threshold (${(threshold * 100).toFixed(1)}%)`,
        timestamp: new Date()
      });
    }
  }

  sendAlert(alert) {
    // Send alert to configured channels (email, Slack, etc.)
    console.log('SUBSCRIPTION_ALERT:', JSON.stringify(alert));
    
    // TODO: Implement alert sending
    // if (alert.severity === 'high') {
    //   await sendToSlack(alert);
    //   await sendEmailAlert(alert);
    // }
    
    // Emit alert event
    this.emit('alert', alert);
  }

  resetDailyMetrics() {
    // Reset daily metrics at midnight
    const metrics = [
      'payments_completed_daily',
      'payments_failed_daily',
      'revenue_daily',
      'subscriptions_created_daily',
      'cancellations_daily'
    ];
    
    metrics.forEach(metric => {
      this.setMetric(metric, 0);
    });
  }

  scheduleHealthChecks() {
    // Run health checks every 5 minutes
    setInterval(() => {
      this.runHealthChecks();
    }, 5 * 60 * 1000);
  }

  runHealthChecks() {
    const healthScore = this.calculateOverallHealthScore();
    
    // Store health check result
    this.healthChecks.set(Date.now(), {
      score: healthScore,
      timestamp: new Date(),
      metrics: Object.fromEntries(this.metrics.entries())
    });
    
    // Keep only last 24 hours of health checks
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [timestamp] of this.healthChecks) {
      if (timestamp < cutoff) {
        this.healthChecks.delete(timestamp);
      }
    }
    
    // Alert if health score is too low
    if (healthScore < 0.7) {
      this.sendAlert({
        type: 'low_health_score',
        severity: 'medium',
        message: `Subscription health score is low: ${(healthScore * 100).toFixed(1)}%`,
        score: healthScore,
        timestamp: new Date()
      });
    }
  }
}

// Create singleton instance
const subscriptionMonitor = new SubscriptionMonitor();

export default subscriptionMonitor;

// Export class for testing
export { SubscriptionMonitor };