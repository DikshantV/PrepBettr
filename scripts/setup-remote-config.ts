/**
 * Firebase Remote Config Setup Script
 * 
 * This script helps setup the required Remote Config parameters in Firebase.
 * Run this after deploying the feature flagging system.
 * 
 * Usage: npx ts-node scripts/setup-remote-config.ts
 */

interface RemoteConfigParameter {
  key: string;
  defaultValue: boolean;
  description: string;
  conditionalValues?: Record<string, any>;
}

const FEATURE_FLAGS: RemoteConfigParameter[] = [
  {
    key: 'autoApplyAzure',
    defaultValue: false,
    description: 'Enable Azure OpenAI-powered automatic job application feature for gradual rollout',
    conditionalValues: {
      // Could add conditions for specific user segments
      // 'beta_users': true,
      // 'enterprise_users': true,
    }
  },
  {
    key: 'portalIntegration',
    defaultValue: false,
    description: 'Enable enhanced job portal integration features (LinkedIn, Indeed, etc.) for gradual rollout',
    conditionalValues: {
      // Could add conditions for specific user segments
      // 'beta_users': true,
      // 'premium_users': true,
    }
  }
];

function generateRemoteConfigJSON() {
  const remoteConfigData = {
    version: {
      versionNumber: "1",
      updateOrigin: "CONSOLE", 
      updateType: "INCREMENTAL_UPDATE",
      updateUser: {
        email: "admin@prepbettr.com"
      }
    },
    parameters: {} as Record<string, any>,
    parameterGroups: {},
    conditions: []
  };

  // Add parameters
  FEATURE_FLAGS.forEach(flag => {
    remoteConfigData.parameters[flag.key] = {
      defaultValue: {
        value: flag.defaultValue.toString()
      },
      description: flag.description,
      valueType: "BOOLEAN"
    };

    // Add conditional values if specified
    if (flag.conditionalValues && Object.keys(flag.conditionalValues).length > 0) {
      remoteConfigData.parameters[flag.key].conditionalValues = flag.conditionalValues;
    }
  });

  return remoteConfigData;
}

function printInstructions() {
  console.log('🚀 Firebase Remote Config Setup for Feature Flags\n');
  
  console.log('📋 Manual Setup Instructions:');
  console.log('1. Go to Firebase Console: https://console.firebase.google.com');
  console.log('2. Select your project: prepbettr');
  console.log('3. Navigate to Remote Config in the left sidebar');
  console.log('4. Add the following parameters:\n');

  FEATURE_FLAGS.forEach((flag, index) => {
    console.log(`   ${index + 1}. Parameter: ${flag.key}`);
    console.log(`      - Type: Boolean`);
    console.log(`      - Default Value: ${flag.defaultValue}`);
    console.log(`      - Description: ${flag.description}\n`);
  });

  console.log('5. Click "Publish changes" to make them live');
  console.log('6. Verify the parameters are available in your app\n');

  console.log('🔧 Programmatic Setup (Alternative):');
  console.log('If you have Firebase Admin SDK configured, you can use the Firebase CLI:');
  console.log('');
  console.log('1. Install Firebase CLI: npm install -g firebase-tools');
  console.log('2. Login: firebase login');
  console.log('3. Set project: firebase use prepbettr');
  console.log('4. Save the JSON below to remote-config.json');
  console.log('5. Deploy: firebase deploy --only remoteconfig\n');

  console.log('📄 Remote Config JSON:');
  console.log('='.repeat(50));
  console.log(JSON.stringify(generateRemoteConfigJSON(), null, 2));
  console.log('='.repeat(50));

  console.log('\n✅ Next Steps:');
  console.log('1. Set up Remote Config parameters using one of the methods above');
  console.log('2. Test feature flags in development environment');
  console.log('3. Monitor error budgets and rollout metrics');
  console.log('4. Gradually increase rollout percentages based on metrics');
  console.log('\n🎯 Rollout Strategy:');
  console.log('- Start: 5% of users (current setting)');
  console.log('- Week 1: Monitor error budgets and user feedback');
  console.log('- Week 2: Increase to 10-15% if metrics are good');
  console.log('- Week 3: Increase to 25-50% based on success');
  console.log('- Week 4: Full rollout to 100% if all metrics pass');

  console.log('\n📊 Monitoring:');
  console.log('- Admin Dashboard: /admin (Feature Flags tab)');
  console.log('- User Settings: /dashboard/settings (AI tab)');
  console.log('- Error Budgets: Tracked automatically in Firestore');
  console.log('- Debug Info: Available in admin panel');
}

// Run the setup instructions
if (require.main === module) {
  printInstructions();
}

export { FEATURE_FLAGS, generateRemoteConfigJSON };
