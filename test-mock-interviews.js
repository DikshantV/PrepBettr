#!/usr/bin/env node
/**
 * Simple test script to verify mock interviews are being created
 * Run with: node test-mock-interviews.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'prepbettr',
  });
}

const db = admin.firestore();

async function testMockInterviews() {
  console.log('🔍 Checking for public mock interviews in Firestore...\n');

  try {
    // Query for public interviews
    const snapshot = await db.collection('interviews')
      .where('userId', '==', 'public')
      .where('finalized', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    console.log(`Found ${snapshot.size} public finalized interviews\n`);

    if (snapshot.size > 0) {
      console.log('Sample interviews:');
      snapshot.docs.slice(0, 3).forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n${index + 1}. Interview ID: ${doc.id}`);
        console.log(`   Role: ${data.role}`);
        console.log(`   Type: ${data.type}`);
        console.log(`   Level: ${data.level}`);
        console.log(`   Tech Stack: ${data.techstack?.join(', ') || 'N/A'}`);
        console.log(`   Questions: ${data.questions?.length || 0} questions`);
        console.log(`   Created: ${data.createdAt}`);
      });
    } else {
      console.log('No public interviews found. They will be created when the dashboard is accessed.');
    }

    console.log('\n✅ Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 9) {
      console.log('\n⚠️  Index required. Deploy indexes with: firebase deploy --only firestore:indexes');
    }
    process.exit(1);
  }
}

// Run the test
testMockInterviews();
