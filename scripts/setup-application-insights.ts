#!/usr/bin/env tsx

/**
 * Application Insights Monitoring Setup for Authentication System
 * 
 * Sets up monitoring, alerts, and dashboards for Firebase Admin SDK with Azure Key Vault integration
 */

import { DefaultAzureCredential } from '@azure/identity';

interface MonitoringConfig {
  authenticationErrors: {
    alertName: string;
    description: string;
    query: string;
    threshold: number;
    severity: number;
  };
  keyVaultFailures: {
    alertName: string;
    description: string; 
    query: string;
    threshold: number;
    severity: number;
  };
  firebaseInitFailures: {
    alertName: string;
    description: string;
    query: string;
    threshold: number;
    severity: number;
  };
  healthCheckFailures: {
    alertName: string;
    description: string;
    query: string;
    threshold: number;
    severity: number;
  };
}

const MONITORING_CONFIG: MonitoringConfig = {
  authenticationErrors: {
    alertName: 'PrepBettr-Auth-Errors',
    description: 'Alert when authentication API calls fail unexpectedly',
    query: `
      requests
      | where url contains "/api/auth/"
      | where resultCode >= 500
      | where timestamp > ago(5m)
      | summarize count() by bin(timestamp, 1m)
    `,
    threshold: 5,
    severity: 2 // High
  },
  
  keyVaultFailures: {
    alertName: 'PrepBettr-KeyVault-Failures',
    description: 'Alert when Azure Key Vault access fails for Firebase secrets',
    query: `
      traces
      | where message contains "Failed to fetch Azure secrets" or 
              message contains "Azure Key Vault" and message contains "error"
      | where timestamp > ago(5m)
      | summarize count() by bin(timestamp, 1m)
    `,
    threshold: 2,
    severity: 1 // Critical
  },
  
  firebaseInitFailures: {
    alertName: 'PrepBettr-Firebase-Init-Failures',
    description: 'Alert when Firebase Admin SDK initialization fails',
    query: `
      traces
      | where message contains "Firebase Admin SDK initialization failed" or
              message contains "Firebase initialization error"
      | where timestamp > ago(5m)
      | summarize count() by bin(timestamp, 1m)
    `,
    threshold: 1,
    severity: 1 // Critical
  },
  
  healthCheckFailures: {
    alertName: 'PrepBettr-Auth-Health-Failures',
    description: 'Alert when authentication health checks fail',
    query: `
      requests
      | where url contains "/api/health/auth" or url contains "/api/health/firebase"
      | where resultCode >= 500
      | where timestamp > ago(5m)
      | summarize count() by bin(timestamp, 1m)
    `,
    threshold: 3,
    severity: 2 // High
  }
};

class ApplicationInsightsSetup {
  private credential: DefaultAzureCredential;
  private resourceGroup: string;
  private subscriptionId: string;
  private appInsightsName: string;

  constructor() {
    this.credential = new DefaultAzureCredential();
    this.resourceGroup = process.env.AZURE_RESOURCE_GROUP || 'prepbettr-rg';
    this.subscriptionId = process.env.AZURE_SUBSCRIPTION_ID || '';
    this.appInsightsName = process.env.AZURE_APP_INSIGHTS_NAME || 'prepbettr-insights';
    
    if (!this.subscriptionId) {
      console.warn('⚠️ AZURE_SUBSCRIPTION_ID not set - Azure portal links will be incomplete');
      this.subscriptionId = 'YOUR_SUBSCRIPTION_ID';
    }
  }

  /**
   * Create KQL queries for authentication monitoring
   */
  generateKQLQueries(): Record<string, string> {
    return {
      // Authentication success rate
      authSuccessRate: `
        requests
        | where url contains "/api/auth/"
        | where timestamp > ago(1h)
        | summarize 
            total = count(),
            success = countif(resultCode < 400),
            rate = (countif(resultCode < 400) * 100.0) / count()
        | project rate, total, success
      `,

      // Firebase Admin SDK health
      firebaseHealth: `
        traces
        | where message contains "Firebase Admin SDK" or message contains "🔥"
        | where timestamp > ago(1h)
        | summarize 
            total = count(),
            errors = countif(message contains "error" or message contains "failed"),
            success = countif(message contains "success" or message contains "initialized")
      `,

      // Azure Key Vault access patterns
      keyVaultAccess: `
        traces
        | where message contains "Azure Key Vault" or message contains "🔑"
        | where timestamp > ago(1h)
        | summarize 
            attempts = count(),
            failures = countif(message contains "Failed to fetch" or message contains "error"),
            success_rate = (count() - countif(message contains "Failed to fetch" or message contains "error")) * 100.0 / count()
        | project attempts, failures, success_rate
      `,

      // Recent authentication errors
      recentAuthErrors: `
        requests
        | where url contains "/api/auth/" and resultCode >= 400
        | where timestamp > ago(15m)
        | project timestamp, url, resultCode, duration
        | order by timestamp desc
        | take 20
      `
    };
  }

  /**
   * Display monitoring setup instructions
   */
  displaySetupInstructions(): void {
    console.log('🚀 PrepBettr Application Insights Monitoring Setup');
    console.log('===============================================\n');

    console.log('📊 MONITORING QUERIES TO CREATE:');
    console.log('================================\n');
    
    const queries = this.generateKQLQueries();
    
    Object.entries(queries).forEach(([name, query]) => {
      console.log(`📈 ${name}:`);
      console.log('```kql');
      console.log(query.trim());
      console.log('```\n');
    });

    console.log('🚨 ALERT RULES TO CREATE:');
    console.log('=========================\n');
    
    Object.entries(MONITORING_CONFIG).forEach(([key, config]) => {
      console.log(`🔔 ${config.alertName}:`);
      console.log(`   Description: ${config.description}`);
      console.log(`   Severity: ${config.severity === 1 ? 'Critical' : 'High'}`);
      console.log(`   Threshold: ${config.threshold} occurrences`);
      console.log('   Query:');
      console.log('   ```kql');
      console.log(config.query.trim());
      console.log('   ```\n');
    });

    console.log('📋 SETUP CHECKLIST:');
    console.log('==================\n');
    console.log('1. ✅ Ensure Application Insights is deployed in Azure');
    console.log('2. ✅ Add APPLICATIONINSIGHTS_CONNECTION_STRING to Azure Key Vault or App Service settings');
    console.log('3. 📊 Create the above KQL queries as saved searches or workbook queries');
    console.log('4. 🚨 Set up the alert rules with appropriate action groups (email/teams/slack)');
    console.log('5. 📈 Create a dashboard with key authentication metrics');
    console.log('6. ✅ Test alerts by triggering authentication failures');
    
    console.log('\n🔗 AZURE PORTAL LINKS:');
    console.log('=====================');
    console.log(`Application Insights: https://portal.azure.com/#@microsoft.onmicrosoft.com/resource/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.Insights/components/${this.appInsightsName}/overview`);
    console.log(`Create Alert Rule: https://portal.azure.com/#@microsoft.onmicrosoft.com/resource/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.Insights/components/${this.appInsightsName}/alertsV2`);
  }

  /**
   * Test Application Insights connectivity
   */
  async testConnectivity(): Promise<void> {
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    
    if (!connectionString) {
      console.warn('⚠️ APPLICATIONINSIGHTS_CONNECTION_STRING not found');
      console.log('💡 Add this to your Azure App Service Application Settings or Azure Key Vault');
      return;
    }

    console.log('✅ Application Insights connection string found');
    console.log('🔍 Connection string preview:', connectionString.substring(0, 50) + '...');
  }
}

async function main() {
  try {
    const setup = new ApplicationInsightsSetup();
    
    console.log('🔍 Testing Application Insights connectivity...\n');
    await setup.testConnectivity();
    
    console.log('\n📋 Displaying monitoring setup instructions...\n');
    setup.displaySetupInstructions();
    
    console.log('✅ Application Insights monitoring setup guide completed!');
    console.log('\n💡 Next steps:');
    console.log('1. Copy the KQL queries and create them in Application Insights');
    console.log('2. Set up alert rules using the provided configurations');
    console.log('3. Test the monitoring by triggering some authentication requests');
    console.log('4. Verify alerts are working by simulating failures');

  } catch (error) {
    console.error('❌ Failed to set up Application Insights monitoring:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ApplicationInsightsSetup, MONITORING_CONFIG };