/**
 * Azure App Configuration Setup Script
 * 
 * This script helps setup the required feature flags and configuration values in Azure App Configuration.
 * Run this after creating your Azure App Configuration instance.
 * 
 * Usage: npx tsx scripts/setup-azure-app-config.ts
 */

interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  conditions?: Record<string, any>;
}

interface ConfigValue {
  key: string;
  value: string;
  description: string;
  contentType?: string;
}

const FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: 'autoApplyAzure',
    enabled: false,
    description: 'Enable Azure OpenAI-powered automatic job application feature for gradual rollout',
    conditions: {
      client_filters: []
    }
  },
  {
    key: 'portalIntegration',
    enabled: false,
    description: 'Enable enhanced job portal integration features (LinkedIn, Indeed, etc.) for gradual rollout',
    conditions: {
      client_filters: []
    }
  }
];

const CONFIG_VALUES: ConfigValue[] = [
  {
    key: 'rolloutPercentage_autoApplyAzure',
    value: '5',
    description: 'Rollout percentage for autoApplyAzure feature (0-100)'
  },
  {
    key: 'rolloutPercentage_portalIntegration',
    value: '5',
    description: 'Rollout percentage for portalIntegration feature (0-100)'
  },
  {
    key: 'errorBudget_autoApplyAzure',
    value: '0.99',
    description: 'Error budget threshold for autoApplyAzure feature (0.0-1.0)'
  },
  {
    key: 'maxApplicationsPerDay',
    value: '50',
    description: 'Maximum number of applications per user per day'
  },
  {
    key: 'maintenance_mode',
    value: 'false',
    description: 'Global maintenance mode flag'
  }
];

function generateAzureCliCommands() {
  console.log('🔧 Azure CLI Commands to Set Up App Configuration:');
  console.log('=' .repeat(60));
  console.log();

  console.log('# 1. Login to Azure');
  console.log('az login');
  console.log();

  console.log('# 2. Set your subscription (replace with your subscription ID)');
  console.log('az account set --subscription "your-subscription-id"');
  console.log();

  console.log('# 3. Create feature flags');
  FEATURE_FLAGS.forEach((flag, index) => {
    console.log(`# Feature Flag ${index + 1}: ${flag.key}`);
    console.log(`az appconfig feature set \\`);
    console.log(`  --connection-string "your-connection-string" \\`);
    console.log(`  --feature ${flag.key} \\`);
    console.log(`  --description "${flag.description}" \\`);
    console.log(`  --enabled ${flag.enabled ? 'true' : 'false'}`);
    console.log();
  });

  console.log('# 4. Set configuration values');
  CONFIG_VALUES.forEach((config, index) => {
    console.log(`# Config ${index + 1}: ${config.key}`);
    console.log(`az appconfig kv set \\`);
    console.log(`  --connection-string "your-connection-string" \\`);
    console.log(`  --key "${config.key}" \\`);
    console.log(`  --value "${config.value}" \\`);
    console.log(`  --content-type "text/plain"`);
    console.log();
  });
}

function generatePowerShellCommands() {
  console.log('🔧 PowerShell Commands to Set Up App Configuration:');
  console.log('=' .repeat(60));
  console.log();

  console.log('# 1. Login to Azure');
  console.log('Connect-AzAccount');
  console.log();

  console.log('# 2. Set your subscription');
  console.log('Select-AzSubscription -SubscriptionId "your-subscription-id"');
  console.log();

  console.log('# 3. Set variables');
  console.log('$connectionString = "your-connection-string"');
  console.log();

  console.log('# 4. Create feature flags');
  FEATURE_FLAGS.forEach((flag, index) => {
    console.log(`# Feature Flag ${index + 1}: ${flag.key}`);
    console.log(`az appconfig feature set \``);
    console.log(`  --connection-string $connectionString \``);
    console.log(`  --feature ${flag.key} \``);
    console.log(`  --description "${flag.description}" \``);
    console.log(`  --enabled ${flag.enabled ? '$true' : '$false'}`);
    console.log();
  });

  console.log('# 5. Set configuration values');
  CONFIG_VALUES.forEach((config, index) => {
    console.log(`# Config ${index + 1}: ${config.key}`);
    console.log(`az appconfig kv set \``);
    console.log(`  --connection-string $connectionString \``);
    console.log(`  --key "${config.key}" \``);
    console.log(`  --value "${config.value}" \``);
    console.log(`  --content-type "text/plain"`);
    console.log();
  });
}

function generateNodeJsScript() {
  console.log('🔧 Node.js Script to Set Up App Configuration:');
  console.log('=' .repeat(60));
  console.log();

  const script = `
const { AppConfigurationClient } = require('@azure/app-configuration');

async function setupAppConfiguration() {
  // Initialize client with connection string
  const client = new AppConfigurationClient(process.env.AZURE_APP_CONFIG_CONNECTION_STRING);

  try {
    // Create feature flags
    const featureFlags = ${JSON.stringify(FEATURE_FLAGS, null, 4)};

    for (const flag of featureFlags) {
      const featureFlagValue = {
        id: flag.key,
        description: flag.description,
        enabled: flag.enabled,
        conditions: flag.conditions || { client_filters: [] }
      };

      await client.setConfigurationSetting({
        key: \`.appconfig.featureflag/\${flag.key}\`,
        value: JSON.stringify(featureFlagValue),
        contentType: 'application/vnd.microsoft.appconfig.ff+json;charset=utf-8'
      });

      console.log(\`✅ Feature flag \${flag.key} created\`);
    }

    // Set configuration values
    const configValues = ${JSON.stringify(CONFIG_VALUES, null, 4)};

    for (const config of configValues) {
      await client.setConfigurationSetting({
        key: config.key,
        value: config.value,
        contentType: config.contentType || 'text/plain'
      });

      console.log(\`✅ Config value \${config.key} set\`);
    }

    console.log('🎉 Azure App Configuration setup complete!');
  } catch (error) {
    console.error('❌ Error setting up Azure App Configuration:', error);
  }
}

setupAppConfiguration();
`;

  console.log(script);
}

function printInstructions() {
  console.log('🚀 Azure App Configuration Setup for Feature Flags\n');
  
  console.log('📋 Prerequisites:');
  console.log('1. Azure subscription with App Configuration service created');
  console.log('2. Azure CLI installed or PowerShell with Az module');
  console.log('3. App Configuration connection string or managed identity configured\n');

  console.log('🔐 Environment Variables Required:');
  console.log('# Azure App Configuration');
  console.log('AZURE_APP_CONFIG_CONNECTION_STRING=Endpoint=https://your-appconfig.azconfig.io;Id=...;Secret=...');
  console.log('# OR');
  console.log('AZURE_APP_CONFIG_ENDPOINT=https://your-appconfig.azconfig.io');
  console.log('# (with Azure managed identity for authentication)\n');

  console.log('📊 Feature Flags to be Created:');
  FEATURE_FLAGS.forEach((flag, index) => {
    console.log(`   ${index + 1}. ${flag.key}`);
    console.log(`      - Enabled: ${flag.enabled}`);
    console.log(`      - Description: ${flag.description}\n`);
  });

  console.log('⚙️ Configuration Values to be Created:');
  CONFIG_VALUES.forEach((config, index) => {
    console.log(`   ${index + 1}. ${config.key} = ${config.value}`);
    console.log(`      - Description: ${config.description}\n`);
  });

  console.log('🎯 Setup Methods (choose one):\n');
  
  console.log('Method 1: Azure CLI');
  generateAzureCliCommands();
  console.log('\n' + '='.repeat(60) + '\n');

  console.log('Method 2: PowerShell');
  generatePowerShellCommands();
  console.log('\n' + '='.repeat(60) + '\n');

  console.log('Method 3: Node.js Script');
  generateNodeJsScript();
  console.log('\n' + '='.repeat(60) + '\n');

  console.log('✅ Next Steps:');
  console.log('1. Choose one setup method above and execute the commands/script');
  console.log('2. Update your .env files with the Azure App Config connection details');
  console.log('3. Test feature flags in development environment');
  console.log('4. Monitor error budgets and rollout metrics');
  console.log('5. Gradually increase rollout percentages based on metrics\n');

  console.log('🎯 Rollout Strategy:');
  console.log('- Start: 5% of users (current setting)');
  console.log('- Week 1: Monitor error budgets and user feedback');
  console.log('- Week 2: Increase to 10-15% if metrics are good');
  console.log('- Week 3: Increase to 25-50% based on success');
  console.log('- Week 4: Full rollout to 100% if all metrics pass\n');

  console.log('📊 Monitoring:');
  console.log('- Admin Dashboard: /admin (Feature Flags tab)');
  console.log('- User Settings: /dashboard/settings (AI tab)');
  console.log('- Error Budgets: Tracked automatically in Firestore');
  console.log('- Debug Info: Available in admin panel');
  console.log('- Azure Portal: Monitor App Configuration usage and metrics\n');

  console.log('🔧 Management:');
  console.log('- Azure Portal: https://portal.azure.com > App Configuration');
  console.log('- Feature flags can be toggled in real-time');
  console.log('- Configuration values can be updated without code deployment');
  console.log('- Supports labels for environment-specific configs (dev, staging, prod)');
}

// Run the setup instructions
if (require.main === module) {
  printInstructions();
}

export { FEATURE_FLAGS, CONFIG_VALUES };
