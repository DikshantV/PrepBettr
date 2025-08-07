#!/usr/bin/env ts-node

/**
 * Firestore Migration Script - Seed Auto-Apply Collections
 * 
 * This script seeds the Firestore database with mock data for the auto-apply feature.
 * It creates the following collections:
 * - users
 * - autoApplySettings  
 * - jobListings
 * - applications
 * - automationLogs
 * 
 * Usage:
 * npm run seed-firestore
 * or
 * npx ts-node scripts/firebase/migrate-seed-data.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import mockData from './mock-data';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize Firebase Admin
function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const requiredEnvVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL', 
    'FIREBASE_PRIVATE_KEY'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');

  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: privateKey,
    }),
  }, 'migration-script');

  return getFirestore(app);
}

// Utility function to convert ISO string dates to Firestore Timestamps
function convertDatesToTimestamps(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string' && data.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/)) {
    return Timestamp.fromDate(new Date(data));
  }

  if (Array.isArray(data)) {
    return data.map(convertDatesToTimestamps);
  }

  if (typeof data === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(data)) {
      converted[key] = convertDatesToTimestamps(value);
    }
    return converted;
  }

  return data;
}

// Seed users collection
async function seedUsers(db: FirebaseFirestore.Firestore) {
  console.log('🔄 Seeding users collection...');
  const usersCollection = db.collection('users');
  
  let userCount = 0;
  for (const [userId, userData] of Object.entries(mockData.users)) {
    try {
      const convertedData = convertDatesToTimestamps(userData);
      await usersCollection.doc(userId).set(convertedData);
      userCount++;
      console.log(`   ✅ Created user: ${userData.name} (${userId})`);
    } catch (error) {
      console.error(`   ❌ Failed to create user ${userId}:`, error);
    }
  }
  
  console.log(`✅ Users collection seeded: ${userCount} documents\n`);
}

// Seed autoApplySettings collection
async function seedAutoApplySettings(db: FirebaseFirestore.Firestore) {
  console.log('🔄 Seeding autoApplySettings collection...');
  const settingsCollection = db.collection('autoApplySettings');
  
  let settingsCount = 0;
  for (const [userId, settings] of Object.entries(mockData.autoApplySettings)) {
    try {
      const convertedData = convertDatesToTimestamps(settings);
      await settingsCollection.doc(userId).set(convertedData);
      settingsCount++;
      console.log(`   ✅ Created settings for user: ${userId} (enabled: ${settings.isEnabled})`);
    } catch (error) {
      console.error(`   ❌ Failed to create settings for ${userId}:`, error);
    }
  }
  
  console.log(`✅ AutoApplySettings collection seeded: ${settingsCount} documents\n`);
}

// Seed jobListings collection
async function seedJobListings(db: FirebaseFirestore.Firestore) {
  console.log('🔄 Seeding jobListings collection...');
  const jobsCollection = db.collection('jobListings');
  
  let jobCount = 0;
  for (const jobListing of mockData.jobListings) {
    try {
      // Transform job listing to match Firestore schema
      const firestoreJobListing = {
        ...jobListing,
        // Add additional fields for Firestore schema
        searchKeywords: [
          ...jobListing.title.toLowerCase().split(' '),
          ...jobListing.requirements.join(' ').toLowerCase().split(' ')
        ].filter(keyword => keyword.length > 2),
        discoveredBy: ['user_123'], // Mock: discovered by user_123
        externalId: `${jobListing.jobPortal.name.toLowerCase()}_${jobListing.id}`,
        isActive: true,
        companySize: 'medium',
        companyIndustry: 'Technology'
      };
      
      // Remove fields that don't exist in Firestore schema
      delete (firestoreJobListing as any).relevancyScore;
      delete (firestoreJobListing as any).matchedSkills;  
      delete (firestoreJobListing as any).missingSkills;
      delete (firestoreJobListing as any).applicationStatus;
      
      const convertedData = convertDatesToTimestamps(firestoreJobListing);
      await jobsCollection.doc(jobListing.id).set(convertedData);
      jobCount++;
      console.log(`   ✅ Created job: ${jobListing.title} at ${jobListing.company}`);
    } catch (error) {
      console.error(`   ❌ Failed to create job ${jobListing.id}:`, error);
    }
  }
  
  console.log(`✅ JobListings collection seeded: ${jobCount} documents\n`);
}

// Seed applications collection
async function seedApplications(db: FirebaseFirestore.Firestore) {
  console.log('🔄 Seeding applications collection...');
  const applicationsCollection = db.collection('applications');
  
  let applicationCount = 0;
  for (const application of mockData.applications) {
    try {
      // Transform application to match Firestore schema
      const firestoreApplication = {
        ...application,
        // Convert automationLog array to match schema
        automationLogIds: application.automationLog.map(log => log.id),
        // Add additional fields for Firestore schema
        matchedSkills: application.automationLog.find(log => log.action === 'relevancy_calculated')?.details?.matchedSkills || [],
        missingSkills: application.automationLog.find(log => log.action === 'relevancy_calculated')?.details?.missingSkills || [],
        relevancyScore: application.automationLog.find(log => log.action === 'relevancy_calculated')?.details?.score
      };
      
      // Remove the automationLog array since it's stored separately
      delete (firestoreApplication as any).automationLog;
      
      const convertedData = convertDatesToTimestamps(firestoreApplication);
      await applicationsCollection.doc(application.id).set(convertedData);
      applicationCount++;
      console.log(`   ✅ Created application: ${application.id} (${application.status})`);
    } catch (error) {
      console.error(`   ❌ Failed to create application ${application.id}:`, error);
    }
  }
  
  console.log(`✅ Applications collection seeded: ${applicationCount} documents\n`);
}

// Seed automationLogs collection
async function seedAutomationLogs(db: FirebaseFirestore.Firestore) {
  console.log('🔄 Seeding automationLogs collection...');
  const logsCollection = db.collection('automationLogs');
  
  let logCount = 0;
  
  // Add standalone automation logs
  for (const logEntry of mockData.automationLogs) {
    try {
      const firestoreLogEntry = {
        ...logEntry,
        userId: logEntry.details?.userId || 'user_123',
        jobId: logEntry.details?.jobId,
        applicationId: logEntry.details?.applicationId,
        executionTime: logEntry.details?.executionTime || Math.floor(Math.random() * 3000) + 500,
        batchId: `batch_${new Date().getTime()}`
      };
      
      const convertedData = convertDatesToTimestamps(firestoreLogEntry);
      await logsCollection.add(convertedData); // Use add() to auto-generate ID
      logCount++;
      console.log(`   ✅ Created log: ${logEntry.action} (${logEntry.status})`);
    } catch (error) {
      console.error(`   ❌ Failed to create log ${logEntry.id}:`, error);
    }
  }
  
  // Add automation logs from applications
  for (const application of mockData.applications) {
    for (const logEntry of application.automationLog) {
      try {
        const firestoreLogEntry = {
          ...logEntry,
          userId: application.userId,
          jobId: application.jobId,
          applicationId: application.id,
          executionTime: logEntry.details?.executionTime || Math.floor(Math.random() * 2000) + 300,
          batchId: `app_${application.id}`
        };
        
        const convertedData = convertDatesToTimestamps(firestoreLogEntry);
        await logsCollection.add(convertedData);
        logCount++;
        console.log(`   ✅ Created app log: ${logEntry.action} for ${application.id}`);
      } catch (error) {
        console.error(`   ❌ Failed to create app log for ${application.id}:`, error);
      }
    }
  }
  
  console.log(`✅ AutomationLogs collection seeded: ${logCount} documents\n`);
}

// Create Firestore indexes configuration
async function createIndexesFile() {
  console.log('🔄 Creating firestore.indexes.json...');
  
  const indexes = {
    indexes: [
      {
        collectionGroup: 'applications',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'status', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'applications', 
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'appliedAt', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'jobListings',
        queryScope: 'COLLECTION', 
        fields: [
          { fieldPath: 'discoveredBy', arrayConfig: 'CONTAINS' },
          { fieldPath: 'isActive', order: 'ASCENDING' },
          { fieldPath: 'postedDate', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'automationLogs',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'timestamp', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'automationLogs',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'action', order: 'ASCENDING' },
          { fieldPath: 'status', order: 'ASCENDING' },
          { fieldPath: 'timestamp', order: 'DESCENDING' }
        ]
      }
    ],
    fieldOverrides: []
  };
  
  const fs = require('fs');
  fs.writeFileSync('firestore.indexes.json', JSON.stringify(indexes, null, 2));
  console.log('✅ Created firestore.indexes.json\n');
}

// Main migration function
async function runMigration() {
  try {
    console.log('🚀 Starting Firestore Auto-Apply Collections Migration\n');
    console.log('📊 Migration Overview:');
    console.log(`   • Users: ${Object.keys(mockData.users).length} documents`);
    console.log(`   • Settings: ${Object.keys(mockData.autoApplySettings).length} documents`);
    console.log(`   • Jobs: ${mockData.jobListings.length} documents`);
    console.log(`   • Applications: ${mockData.applications.length} documents`);
    console.log(`   • Logs: ${mockData.automationLogs.length}+ documents\n`);
    
    const db = initializeFirebaseAdmin();
    console.log('✅ Firebase Admin initialized\n');
    
    // Run migrations in order
    await seedUsers(db);
    await seedAutoApplySettings(db);
    await seedJobListings(db);
    await seedApplications(db);
    await seedAutomationLogs(db);
    
    // Create indexes file
    await createIndexesFile();
    
    console.log('🎉 Migration completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('1. Deploy indexes: firebase deploy --only firestore:indexes');
    console.log('2. Update security rules: firebase deploy --only firestore:rules');
    console.log('3. Test the application with seeded data');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Clean up admin app
    const app = getApps().find(app => app.name === 'migration-script');
    if (app) {
      await app.delete();
    }
  }
}

// Allow direct execution
if (require.main === module) {
  runMigration().catch(console.error);
}

export { runMigration, convertDatesToTimestamps };
