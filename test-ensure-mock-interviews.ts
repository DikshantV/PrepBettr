#!/usr/bin/env ts-node
/**
 * Test script to verify ensureMockInterviews functionality
 * Run with: npx ts-node test-ensure-mock-interviews.ts
 */

// Use require instead of import to avoid TypeScript module resolution issues
const { ensureMockInterviews } = require('./lib/actions/dashboard.action');
const { db } = require('./firebase/admin');

async function testEnsureMockInterviews() {
  console.log('🚀 Testing ensureMockInterviews function...\n');

  try {
    // Test 1: Request 5 mock interviews
    console.log('Test 1: Requesting 5 mock interviews...');
    const interviews1 = await ensureMockInterviews(5);
    console.log(`✅ Retrieved ${interviews1.length} interviews`);
    console.log('Sample interview:', {
      id: interviews1[0]?.id,
      role: interviews1[0]?.role,
      userId: interviews1[0]?.userId,
      finalized: interviews1[0]?.finalized,
    });

    // Test 2: Request again to ensure consistency
    console.log('\nTest 2: Requesting 5 interviews again (should return existing)...');
    const interviews2 = await ensureMockInterviews(5);
    console.log(`✅ Retrieved ${interviews2.length} interviews`);
    
    // Verify they're the same interviews
    const ids1 = interviews1.map((i: any) => i.id).sort();
    const ids2 = interviews2.map((i: any) => i.id).sort();
    const areConsistent = ids1.every((id: any, index: number) => id === ids2[index]);
    console.log(`Consistency check: ${areConsistent ? '✅ PASSED' : '❌ FAILED'}`);

    // Test 3: Request more interviews than exist
    console.log('\nTest 3: Requesting 10 interviews (may create new ones)...');
    const interviews3 = await ensureMockInterviews(10);
    console.log(`✅ Retrieved ${interviews3.length} interviews`);

    // Verify all are public and finalized
    const allPublic = interviews3.every((i: any) => i.userId === 'public');
    const allFinalized = interviews3.every((i: any) => i.finalized === true);
    console.log(`All public: ${allPublic ? '✅' : '❌'}`);
    console.log(`All finalized: ${allFinalized ? '✅' : '❌'}`);

    // Test 4: Check database directly
    console.log('\nTest 4: Verifying database consistency...');
    const dbQuery = await db.collection('interviews')
      .where('userId', '==', 'public')
      .where('finalized', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    console.log(`Database has ${dbQuery.size} public finalized interviews`);

    // Clean up test data (optional - comment out if you want to keep the data)
    // console.log('\n🧹 Cleaning up test data...');
    // const batch = db.batch();
    // dbQuery.docs.forEach(doc => {
    //   if (doc.id.startsWith('mock-')) {
    //     batch.delete(doc.ref);
    //   }
    // });
    // await batch.commit();
    // console.log('✅ Cleanup complete');

    console.log('\n✅ All tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
testEnsureMockInterviews();
