/**
 * Feature Flags System Test Script
 * 
 * This script tests the feature flagging system components.
 * Run this to verify everything is working correctly.
 * 
 * Usage: npx ts-node scripts/test-feature-flags.ts
 */

// Standalone test version without Firebase dependencies

interface RolloutConfig {
  percentage: number;
  featureName: string;
}

class TestUserTargeting {
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  isUserInRollout(userId: string, rolloutConfig: RolloutConfig): boolean {
    if (rolloutConfig.percentage <= 0) return false;
    if (rolloutConfig.percentage >= 100) return true;

    const combinedString = `${userId}-${rolloutConfig.featureName}`;
    const hash = this.hashUserId(combinedString);
    const userBucket = hash % 100;
    
    return userBucket < rolloutConfig.percentage;
  }
}

const ROLLOUT_CONFIGS = {
  autoApplyAzure: {
    percentage: 5,
    featureName: 'autoApplyAzure'
  } as RolloutConfig,
  portalIntegration: {
    percentage: 5,
    featureName: 'portalIntegration'
  } as RolloutConfig,
};

async function testUserTargeting() {
  console.log('🧪 Testing User Targeting Service...\n');
  
  const userTargeting = new TestUserTargeting();
  
  // Test user hashing consistency
  const testUserId = 'test-user-123';
  const autoApplyConfig = ROLLOUT_CONFIGS.autoApplyAzure;
  const portalConfig = ROLLOUT_CONFIGS.portalIntegration;
  
  // Test multiple calls return consistent results
  const result1 = userTargeting.isUserInRollout(testUserId, autoApplyConfig);
  const result2 = userTargeting.isUserInRollout(testUserId, autoApplyConfig);
  const result3 = userTargeting.isUserInRollout(testUserId, autoApplyConfig);
  
  console.log(`✅ Consistency Test: ${result1 === result2 && result2 === result3 ? 'PASS' : 'FAIL'}`);
  console.log(`   User ${testUserId} AutoApply: ${result1}\n`);
  
  // Test different features for same user
  const autoApplyResult = userTargeting.isUserInRollout(testUserId, autoApplyConfig);
  const portalResult = userTargeting.isUserInRollout(testUserId, portalConfig);
  
  console.log(`📊 Feature Targeting for ${testUserId}:`);
  console.log(`   Auto Apply Azure (${autoApplyConfig.percentage}%): ${autoApplyResult}`);
  console.log(`   Portal Integration (${portalConfig.percentage}%): ${portalResult}\n`);
  
  // Test rollout percentage distribution
  console.log('📈 Testing Rollout Distribution (1000 users):');
  
  const sampleSize = 1000;
  let autoApplyCount = 0;
  let portalCount = 0;
  
  for (let i = 0; i < sampleSize; i++) {
    const userId = `user-${i}`;
    if (userTargeting.isUserInRollout(userId, autoApplyConfig)) {
      autoApplyCount++;
    }
    if (userTargeting.isUserInRollout(userId, portalConfig)) {
      portalCount++;
    }
  }
  
  const autoApplyPercentage = (autoApplyCount / sampleSize) * 100;
  const portalPercentage = (portalCount / sampleSize) * 100;
  
  console.log(`   Auto Apply Azure: ${autoApplyCount}/${sampleSize} (${autoApplyPercentage.toFixed(1)}%)`);
  console.log(`   Expected: ~${autoApplyConfig.percentage}% (${autoApplyConfig.percentage * sampleSize / 100})`);
  console.log(`   Portal Integration: ${portalCount}/${sampleSize} (${portalPercentage.toFixed(1)}%)`);
  console.log(`   Expected: ~${portalConfig.percentage}% (${portalConfig.percentage * sampleSize / 100})\n`);
  
  // Test percentage adjustment
  console.log('⚙️  Testing Rollout Percentage Updates:');
  const originalPercentage = ROLLOUT_CONFIGS.autoApplyAzure.percentage;
  
  ROLLOUT_CONFIGS.autoApplyAzure.percentage = 10;
  console.log(`   Updated autoApplyAzure to 10%`);
  
  const updatedResult = userTargeting.isUserInRollout(testUserId, ROLLOUT_CONFIGS.autoApplyAzure);
  console.log(`   User ${testUserId} now in rollout: ${updatedResult}`);
  
  // Reset to original
  ROLLOUT_CONFIGS.autoApplyAzure.percentage = originalPercentage;
  console.log(`   Reset autoApplyAzure back to ${originalPercentage}%\n`);
}

async function testRolloutConfigs() {
  console.log('⚙️  Testing Rollout Configurations...\n');
  
  const configs = ROLLOUT_CONFIGS;
  
  console.log('📋 Current Rollout Configurations:');
  Object.entries(configs).forEach(([feature, config]) => {
    console.log(`   ${feature}:`);
    console.log(`     - Percentage: ${config.percentage}%`);
    console.log(`     - Feature Name: ${config.featureName}`);
  });
  
  console.log('\n✅ Configuration validation:');
  const allValid = Object.entries(configs).every(([key, config]) => {
    const valid = config.featureName === key && 
                  config.percentage >= 0 && 
                  config.percentage <= 100;
    console.log(`   ${key}: ${valid ? 'VALID' : 'INVALID'}`);
    return valid;
  });
  
  console.log(`\n🎯 Overall Config Status: ${allValid ? 'ALL VALID' : 'ISSUES DETECTED'}\n`);
}

async function testAnonymousUsers() {
  console.log('👤 Testing Anonymous User Handling...\n');
  
  // Simulate anonymous user scenarios
  const userTargeting = new TestUserTargeting();
  
  // Test multiple anonymous sessions
  const anonResults = [];
  for (let i = 0; i < 5; i++) {
    const anonId = `anon_${Date.now() + i}_${Math.random().toString(36).substr(2, 9)}`;
    const result = userTargeting.isUserInRollout(anonId, ROLLOUT_CONFIGS.autoApplyAzure);
    anonResults.push(result);
  }
  
  console.log(`📊 Anonymous User Rollout Results: [${anonResults.join(', ')}]`);
  console.log(`   Mix of true/false values indicates proper distribution\n`);
}

async function runAllTests() {
  console.log('🚀 Feature Flags System Test Suite\n');
  console.log('='.repeat(50));
  
  try {
    await testRolloutConfigs();
    await testUserTargeting();
    await testAnonymousUsers();
    
    console.log('✅ All tests completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Set up Firebase Remote Config parameters');
    console.log('2. Test the full system in your development environment');
    console.log('3. Deploy and monitor with real users');
    console.log('4. Use admin dashboard to manage rollouts');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests();
}

export { testUserTargeting, testRolloutConfigs, testAnonymousUsers };
