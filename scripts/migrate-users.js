#!/usr/bin/env node

/**
 * Standalone migration script for initializing user subscriptions and usage counters
 * Can be run directly with Node.js without starting the Next.js server
 * 
 * Usage: 
 * - Set environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * - Run: node scripts/migrate-users.js
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Default usage limits
const DEFAULT_USAGE_LIMITS = {
  free: {
    interviews: { count: 0, limit: 3 },
    resumeTailor: { count: 0, limit: 2 },
    autoApply: { count: 0, limit: 1 },
  },
  premium: {
    interviews: { count: 0, limit: -1 }, // -1 = unlimited
    resumeTailor: { count: 0, limit: -1 },
    autoApply: { count: 0, limit: -1 },
  },
};

async function initializeFirebaseAdmin() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    throw new Error('Missing Firebase service account credentials. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.');
  }

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

async function initializeUserSubscription(db, userId, email, name) {
  console.log(`Processing user: ${userId} (${email})`);
  
  // Update user document with subscription fields
  await db.collection('users').doc(userId).set({
    plan: 'free',
    planStatus: 'active',
    currentPeriodEnd: null,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  // Initialize usage counters
  const defaultCounters = DEFAULT_USAGE_LIMITS.free;
  const batch = db.batch();

  Object.entries(defaultCounters).forEach(([feature, counter]) => {
    const counterRef = db
      .collection('usage')
      .doc(userId)
      .collection('counters')
      .doc(feature);
    
    batch.set(counterRef, {
      ...counter,
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
  console.log(`✅ User ${userId} initialized successfully`);
}

async function runMigration() {
  try {
    console.log('🚀 Starting Firestore subscription schema migration...');
    
    // Initialize Firebase Admin
    const app = await initializeFirebaseAdmin();
    const db = getFirestore(app);
    
    console.log('📊 Fetching users from Firestore...');
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('ℹ️  No users found in the database.');
      return;
    }
    
    console.log(`📋 Found ${usersSnapshot.size} users to migrate`);
    
    // Process users in batches to avoid overwhelming Firestore
    const BATCH_SIZE = 10;
    const users = usersSnapshot.docs;
    
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(users.length/BATCH_SIZE)}`);
      
      const promises = batch.map(async (userDoc) => {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const email = userData.email || 'unknown@example.com';
        const name = userData.name || 'User';

        await initializeUserSubscription(db, userId, email, name);
      });
      
      await Promise.all(promises);
      
      // Small delay between batches
      if (i + BATCH_SIZE < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log(`📈 Migrated ${users.length} users with subscription fields and usage counters.`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
