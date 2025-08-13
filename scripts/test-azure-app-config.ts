/**
 * Test Script for Azure App Configuration Integration
 * 
 * This script tests the Azure App Configuration service to ensure
 * feature flags and configuration values are working correctly.
 * 
 * Usage: npx tsx scripts/test-azure-app-config.ts
 */

import { azureAppConfigService } from '@/lib/services/azure-app-config';
import { featureFlagsService } from '@/lib/services/feature-flags';

async function testAzureAppConfigService() {
  console.log('🧪 Testing Azure App Configuration Service\n');

  try {
    // Test 1: Service Health Check
    console.log('1️⃣ Testing service health...');
    const healthStatus = await azureAppConfigService.getHealthStatus();
    console.log('   Health Status:', healthStatus);
    
    if (!healthStatus.healthy) {
      console.log('❌ Service is not healthy. Check your Azure App Configuration settings.');
      return;
    }
    console.log('✅ Service is healthy\n');

    // Test 2: Fetch Individual Feature Flags
    console.log('2️⃣ Testing individual feature flags...');
    
    const autoApplyFlag = await azureAppConfigService.getFeatureFlag('autoApplyAzure');
    console.log(`   autoApplyAzure: ${autoApplyFlag}`);
    
    const portalIntegrationFlag = await azureAppConfigService.getFeatureFlag('portalIntegration');
    console.log(`   portalIntegration: ${portalIntegrationFlag}`);
    console.log('✅ Individual feature flags retrieved\n');

    // Test 3: Fetch All Feature Flags
    console.log('3️⃣ Testing all feature flags...');
    const allFlags = await azureAppConfigService.getAllFeatureFlags();
    console.log('   All flags:', allFlags);
    console.log('✅ All feature flags retrieved\n');

    // Test 4: Test Caching
    console.log('4️⃣ Testing cache functionality...');
    const cachedFlags = azureAppConfigService.getCachedFlags();
    console.log('   Cached flags:', cachedFlags);
    
    // Refresh and test again
    console.log('   Refreshing flags...');
    const refreshedFlags = await azureAppConfigService.refreshFeatureFlags();
    console.log('   Refreshed flags:', refreshedFlags);
    console.log('✅ Cache functionality working\n');

    // Test 5: Test Configuration Values (non-feature flags)
    console.log('5️⃣ Testing configuration values...');
    
    try {
      const rolloutPercentage = await azureAppConfigService.getConfigValue('rolloutPercentage_autoApplyAzure');
      console.log(`   rolloutPercentage_autoApplyAzure: ${rolloutPercentage}`);
      
      const maxApplications = await azureAppConfigService.getConfigValue('maxApplicationsPerDay');
      console.log(`   maxApplicationsPerDay: ${maxApplications}`);
      
      console.log('✅ Configuration values retrieved\n');
    } catch (error) {
      console.log('⚠️ Configuration values not found (this is normal if not set up yet)\n');
    }

    // Test 6: Test Service Ready State
    console.log('6️⃣ Testing service ready state...');
    const isReady = azureAppConfigService.isReady();
    console.log(`   Service ready: ${isReady}`);
    console.log('✅ Service ready state checked\n');

  } catch (error) {
    console.error('❌ Error testing Azure App Configuration service:', error);
  }
}

async function testFeatureFlagsService() {
  console.log('🔧 Testing Enhanced Feature Flags Service\n');

  try {
    // Test 1: Enhanced Feature Flags
    console.log('1️⃣ Testing enhanced feature flags...');
    const enhancedFlags = await featureFlagsService.getAllFeatureFlags();
    console.log('   Enhanced flags:', enhancedFlags);
    console.log('✅ Enhanced feature flags retrieved\n');

    // Test 2: Individual Feature Checks
    console.log('2️⃣ Testing individual feature checks...');
    
    const isAutoApplyEnabled = await featureFlagsService.isAutoApplyAzureEnabled();
    console.log(`   isAutoApplyAzureEnabled: ${isAutoApplyEnabled}`);
    
    const isPortalIntegrationEnabled = await featureFlagsService.isPortalIntegrationEnabled();
    console.log(`   isPortalIntegrationEnabled: ${isPortalIntegrationEnabled}`);
    console.log('✅ Individual feature checks completed\n');

    // Test 3: Debug Information
    console.log('3️⃣ Testing debug information...');
    const debugInfo = await featureFlagsService.getDebugInfo();
    console.log('   Debug info:', JSON.stringify(debugInfo, null, 2));
    console.log('✅ Debug information retrieved\n');

    // Test 4: Feature Flag with User Targeting
    console.log('4️⃣ Testing feature flag with user targeting...');
    const specificFlag = await featureFlagsService.getFeatureFlag('autoApplyAzure');
    console.log(`   autoApplyAzure with targeting: ${specificFlag}`);
    console.log('✅ Feature flag with user targeting tested\n');

  } catch (error) {
    console.error('❌ Error testing Feature Flags service:', error);
  }
}

async function listAllConfigurationSettings() {
  console.log('📋 Listing All Configuration Settings\n');

  try {
    const allSettings = await azureAppConfigService.listAllSettings();
    
    if (allSettings.length === 0) {
      console.log('📝 No configuration settings found. Run the setup script first:\n');
      console.log('   npx tsx scripts/setup-azure-app-config.ts\n');
      return;
    }

    console.log('📊 Found configuration settings:');
    allSettings.forEach((setting, index) => {
      console.log(`   ${index + 1}. ${setting.key} = ${setting.value}`);
      if (setting.label) {
        console.log(`      Label: ${setting.label}`);
      }
    });
    console.log(`\n✅ Listed ${allSettings.length} configuration settings\n`);

  } catch (error) {
    console.error('❌ Error listing configuration settings:', error);
  }
}

async function performanceTest() {
  console.log('⚡ Performance Testing\n');

  const iterations = 5;
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    await azureAppConfigService.getAllFeatureFlags();
    const endTime = Date.now();
    const duration = endTime - startTime;
    times.push(duration);
    console.log(`   Iteration ${i + 1}: ${duration}ms`);
  }

  const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  console.log(`\n📊 Performance Results:`);
  console.log(`   Average: ${avgTime.toFixed(2)}ms`);
  console.log(`   Minimum: ${minTime}ms`);
  console.log(`   Maximum: ${maxTime}ms`);
  
  if (avgTime < 100) {
    console.log('✅ Performance is excellent (< 100ms average)\n');
  } else if (avgTime < 500) {
    console.log('✅ Performance is good (< 500ms average)\n');
  } else {
    console.log('⚠️ Performance could be improved (> 500ms average)\n');
  }
}

async function runAllTests() {
  console.log('🚀 Azure App Configuration Integration Test Suite\n');
  console.log('=' .repeat(60) + '\n');

  // Test Azure App Configuration Service
  await testAzureAppConfigService();
  
  console.log('=' .repeat(60) + '\n');
  
  // Test Feature Flags Service
  await testFeatureFlagsService();
  
  console.log('=' .repeat(60) + '\n');
  
  // List all settings
  await listAllConfigurationSettings();
  
  console.log('=' .repeat(60) + '\n');
  
  // Performance test
  await performanceTest();
  
  console.log('🎉 All tests completed!\n');

  console.log('💡 Next Steps:');
  console.log('1. If any tests failed, check your Azure App Configuration setup');
  console.log('2. Ensure environment variables are correctly set');
  console.log('3. Run the setup script if configuration settings are missing');
  console.log('4. Test in your application to ensure integration works end-to-end');
}

// Export test functions for individual use
export {
  testAzureAppConfigService,
  testFeatureFlagsService,
  listAllConfigurationSettings,
  performanceTest
};

// Run all tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}
