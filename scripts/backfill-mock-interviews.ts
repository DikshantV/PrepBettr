#!/usr/bin/env tsx

/**
 * Backfill Mock Interviews Script
 * 
 * This script seeds the first 20 Azure-generated mock interviews to Firestore
 * during CI deployment. It ensures a variety of roles, companies, and tech stacks
 * for the initial mock interview collection.
 * 
 * Usage:
 *   npm run backfill:mock-interviews
 *   or
 *   tsx scripts/backfill-mock-interviews.ts
 * 
 * Environment Requirements:
 *   - AZURE_OPENAI_API_KEY
 *   - AZURE_OPENAI_ENDPOINT
 *   - AZURE_OPENAI_DEPLOYMENT
 *   - FIREBASE_PROJECT_ID
 *   - FIREBASE_CLIENT_EMAIL
 *   - FIREBASE_PRIVATE_KEY
 *   - USE_AZURE_MOCK (feature flag)
 */

import { config } from 'dotenv';
import { getAdminFirestore } from '../lib/firebase/admin';
import { MockInterviewService } from '../lib/services/mock-interview.service';
// import { Interview } from '../types/index.d'; // Cannot import from .d.ts files
import { initializeAzureEnvironment } from '../lib/azure-config';

// Load environment variables
config();

// Configuration
const BATCH_SIZE = 5; // Process interviews in batches to avoid rate limits
const TOTAL_INTERVIEWS = 20; // Total number of interviews to generate
const RETRY_ATTEMPTS = 3; // Number of retry attempts for failed generations
const RETRY_DELAY = 2000; // Delay between retries in milliseconds
const COLLECTION_NAME = 'mockInterviews'; // Firestore collection name

// Feature flag check
const USE_AZURE_MOCK = process.env.USE_AZURE_MOCK === 'true';

// Statistics tracking
interface GenerationStats {
  totalAttempted: number;
  successful: number;
  failed: number;
  retries: number;
  duration: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}

const stats: GenerationStats = {
  totalAttempted: 0,
  successful: 0,
  failed: 0,
  retries: 0,
  duration: 0,
  tokenUsage: {
    prompt: 0,
    completion: 0,
    total: 0
  }
};

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a single mock interview with retry logic
 */
async function generateMockInterview(
  service: MockInterviewService, 
  index: number
): Promise<any> {
  let attempts = 0;
  
  while (attempts < RETRY_ATTEMPTS) {
    try {
      console.log(`🎯 Generating interview ${index + 1}/${TOTAL_INTERVIEWS} (attempt ${attempts + 1})...`);
      
      const interview = await service.createMockInterview(`mock-seed-${index}`);
      
      // Add metadata for tracking
      const enhancedInterview: any = {
        ...interview,
        metadata: {
          ...((interview as any).metadata || {}),
          generatedBy: 'backfill-script',
          generatedAt: new Date().toISOString(),
          azureGenerated: true,
          batchIndex: Math.floor(index / BATCH_SIZE),
          environment: process.env.NODE_ENV || 'development'
        }
      };
      
      console.log(`✅ Generated interview: ${enhancedInterview.role}`);
      stats.successful++;
      
      return enhancedInterview;
    } catch (error) {
      attempts++;
      stats.retries++;
      
      console.error(`❌ Failed to generate interview ${index + 1} (attempt ${attempts}):`, error);
      
      if (attempts < RETRY_ATTEMPTS) {
        console.log(`⏳ Retrying in ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY);
      } else {
        stats.failed++;
        return null;
      }
    }
  }
  
  return null;
}

/**
 * Save interviews to Firestore
 */
async function saveToFirestore(interviews: any[]): Promise<void> {
  const db = await getAdminFirestore();
  const batch = db.batch();
  
  for (const interview of interviews) {
    const docRef = db.collection(COLLECTION_NAME).doc(interview.id);
    batch.set(docRef, {
      ...interview,
      createdAt: interview.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  await batch.commit();
  console.log(`💾 Saved ${interviews.length} interviews to Firestore`);
}

/**
 * Verify existing mock interviews in Firestore
 */
async function getExistingInterviewCount(): Promise<number> {
  const db = await getAdminFirestore();
  const snapshot = await db.collection(COLLECTION_NAME)
    .where('metadata.generatedBy', '==', 'backfill-script')
    .get();
  
  return snapshot.docs.length;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  console.log('🚀 Starting Mock Interview Backfill Script');
  console.log('==========================================');
  
  const startTime = Date.now();
  
  try {
    // Check feature flag
    if (!USE_AZURE_MOCK) {
      console.log('⚠️ USE_AZURE_MOCK feature flag is not enabled');
      console.log('Set USE_AZURE_MOCK=true in environment to enable');
      process.exit(0);
    }
    
    // Validate environment
    const requiredEnvVars = [
      'AZURE_OPENAI_API_KEY',
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_DEPLOYMENT',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:');
      missingVars.forEach(varName => console.error(`  - ${varName}`));
      process.exit(1);
    }
    
    // Initialize Azure environment
    console.log('🔧 Initializing Azure environment...');
    await initializeAzureEnvironment();
    
    // Check existing interviews
    const existingCount = await getExistingInterviewCount();
    if (existingCount >= TOTAL_INTERVIEWS) {
      console.log(`✅ Already have ${existingCount} mock interviews. Skipping generation.`);
      process.exit(0);
    }
    
    const interviewsToGenerate = TOTAL_INTERVIEWS - existingCount;
    console.log(`📊 Found ${existingCount} existing interviews. Generating ${interviewsToGenerate} more.`);
    
    // Initialize Mock Interview Service
    console.log('🔧 Initializing Mock Interview Service...');
    const mockService = new MockInterviewService();
    const initialized = await mockService.initialize();
    
    if (!initialized) {
      throw new Error('Failed to initialize Mock Interview Service');
    }
    
    console.log('✅ Mock Interview Service initialized');
    console.log(`🎲 Generating ${interviewsToGenerate} mock interviews...`);
    console.log('');
    
    // Generate interviews in batches
    const allInterviews: any[] = [];
    
    for (let batch = 0; batch < Math.ceil(interviewsToGenerate / BATCH_SIZE); batch++) {
      const batchStart = batch * BATCH_SIZE + existingCount;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_INTERVIEWS);
      const batchSize = batchEnd - batchStart;
      
      console.log(`\n📦 Processing batch ${batch + 1} (interviews ${batchStart + 1}-${batchEnd})...`);
      
      // Generate batch interviews in parallel
      const batchPromises = Array.from({ length: batchSize }, (_, i) => 
        generateMockInterview(mockService, batchStart + i)
      );
      
      const batchResults = await Promise.all(batchPromises);
      const validInterviews = batchResults.filter((i): i is any => i !== null);
      
      if (validInterviews.length > 0) {
        // Save batch to Firestore
        await saveToFirestore(validInterviews);
        allInterviews.push(...validInterviews);
      }
      
      // Add delay between batches to avoid rate limits
      if (batch < Math.ceil(interviewsToGenerate / BATCH_SIZE) - 1) {
        console.log('⏳ Waiting before next batch...');
        await sleep(3000);
      }
    }
    
    // Clear service caches to free memory
    mockService.clearCaches();
    
    // Calculate statistics
    stats.duration = Date.now() - startTime;
    stats.totalAttempted = interviewsToGenerate;
    
    // Print summary
    console.log('\n==========================================');
    console.log('📊 Backfill Summary');
    console.log('==========================================');
    console.log(`✅ Successfully generated: ${stats.successful} interviews`);
    console.log(`❌ Failed generations: ${stats.failed}`);
    console.log(`🔄 Total retries: ${stats.retries}`);
    console.log(`⏱️ Total duration: ${(stats.duration / 1000).toFixed(2)} seconds`);
    console.log(`📈 Average time per interview: ${(stats.duration / stats.successful / 1000).toFixed(2)} seconds`);
    
    // Verify final count
    const finalCount = await getExistingInterviewCount();
    console.log(`\n🎯 Total mock interviews in Firestore: ${finalCount}`);
    
    if (stats.successful === interviewsToGenerate) {
      console.log('\n✨ Mock interview backfill completed successfully!');
      process.exit(0);
    } else {
      console.log(`\n⚠️ Backfill completed with ${stats.failed} failures`);
      process.exit(stats.failed > 0 ? 1 : 0);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error during backfill:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

// Export for testing
export { main, generateMockInterview, saveToFirestore, getExistingInterviewCount };
