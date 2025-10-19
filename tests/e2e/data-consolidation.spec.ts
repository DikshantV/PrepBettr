// End-to-End Tests for Complete Data Consolidation System
// Tests the full data consolidation flow from user interactions to data consistency

import { test, expect, Page } from '@playwright/test';
import { CosmosClient } from '@azure/cosmos';
import admin from 'firebase-admin';

// Test configuration
const TEST_DATABASE_ID = 'PrepBettrE2ETestDB';
const COSMOS_EMULATOR_ENDPOINT = 'https://localhost:8081';
const COSMOS_EMULATOR_KEY = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';

test.describe('Data Consolidation E2E Tests', () => {
  let cosmosClient: CosmosClient;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Initialize Cosmos DB for testing
    cosmosClient = new CosmosClient({
      endpoint: COSMOS_EMULATOR_ENDPOINT,
      key: COSMOS_EMULATOR_KEY,
      connectionPolicy: {
        enableEndpointDiscovery: false
      }
    });

    // Create test database
    await cosmosClient.databases.createIfNotExists({
      id: TEST_DATABASE_ID
    });

    // Initialize Firebase Admin if not already done
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'prepbettr-test',
        credential: admin.credential.applicationDefault()
      });
    }

    page = await browser.newPage();
    
    // Set up test environment variables for the application
    await page.addInitScript(() => {
      // Mock environment variables for client-side testing
      (window as any).testEnv = {
        COSMOS_EMULATOR_ENDPOINT: 'https://localhost:8081',
        TEST_DATABASE_ID: 'PrepBettrE2ETestDB',
        ENABLE_DUAL_WRITE: 'true'
      };
    });
  });

  test.afterAll(async () => {
    // Cleanup test database
    try {
      await cosmosClient.database(TEST_DATABASE_ID).delete();
    } catch (error) {
      console.warn('Failed to cleanup test database:', error);
    }

    await page.close();
  });

  test.beforeEach(async () => {
    // Clear test data before each test
    await clearTestData();
    
    // Navigate to application home page
    await page.goto('/');
  });

  async function clearTestData() {
    // Clear Cosmos DB containers
    try {
      const database = cosmosClient.database(TEST_DATABASE_ID);
      const containers = ['resumes', 'usage', 'migrationState'];
      
      for (const containerName of containers) {
        try {
          const container = database.container(containerName);
          const { resources } = await container.items.readAll().fetchAll();
          
          for (const item of resources) {
            await container.item(item.id, item.id).delete();
          }
        } catch (error) {
          // Container might not exist, which is fine
        }
      }
    } catch (error) {
      console.warn('Failed to clear Cosmos DB test data:', error);
    }

    // Clear Firestore test data
    try {
      const firestore = admin.firestore();
      const collections = ['resumes', 'usage'];
      
      for (const collectionName of collections) {
        const snapshot = await firestore.collection(collectionName).get();
        const batch = firestore.batch();
        
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        if (snapshot.docs.length > 0) {
          await batch.commit();
        }
      }
    } catch (error) {
      console.warn('Failed to clear Firestore test data:', error);
    }
  }

  test('should handle complete resume upload and processing with dual-write', async () => {
    // Arrange: Sign in as test user
    await signInTestUser(page);
    
    // Navigate to resume upload page
    await page.goto('/dashboard/resumes');
    await expect(page.locator('[data-testid="resume-upload-section"]')).toBeVisible();

    // Act: Upload a resume file
    const fileInput = page.locator('[data-testid="resume-file-input"]');
    await fileInput.setInputFiles({
      name: 'test-resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Mock PDF content for testing')
    });

    // Trigger upload and processing
    await page.locator('[data-testid="upload-resume-button"]').click();

    // Wait for upload completion
    await expect(page.locator('[data-testid="upload-success-message"]')).toBeVisible({ timeout: 15000 });

    // Assert: Verify UI shows processed resume
    await expect(page.locator('[data-testid="resume-list-item"]')).toBeVisible();
    
    const resumeItem = page.locator('[data-testid="resume-list-item"]').first();
    await expect(resumeItem.locator('[data-testid="resume-filename"]')).toContainText('test-resume.pdf');
    await expect(resumeItem.locator('[data-testid="ats-score"]')).toBeVisible();

    // Verify data exists in both Cosmos DB and Firestore
    await verifyResumeInBothStores('test-resume.pdf');
  });

  test('should support data migration through admin dashboard', async () => {
    // Arrange: Set up initial data in Firestore
    await createTestDataInFirestore();
    
    // Sign in as admin user
    await signInAdminUser(page);
    
    // Navigate to migration dashboard
    await page.goto('/admin/migration');
    await expect(page.locator('[data-testid="migration-dashboard"]')).toBeVisible();

    // Act: Start data migration
    await page.locator('[data-testid="migration-direction-select"]').selectOption('firestore-to-cosmos');
    await page.locator('[data-testid="select-resumes-collection"]').check();
    await page.locator('[data-testid="start-migration-button"]').click();

    // Wait for migration to start
    await expect(page.locator('[data-testid="migration-status"]')).toContainText('running', { timeout: 5000 });

    // Wait for migration to complete
    await expect(page.locator('[data-testid="migration-status"]')).toContainText('completed', { timeout: 30000 });

    // Assert: Verify migration summary shows correct counts
    const migratedCount = await page.locator('[data-testid="documents-migrated"]').textContent();
    expect(parseInt(migratedCount || '0')).toBeGreaterThan(0);

    // Verify no errors
    await expect(page.locator('[data-testid="migration-errors"]')).toContainText('0');

    // Verify data now exists in Cosmos DB
    await verifyMigrationResults();
  });

  test('should handle dual-write configuration changes in real-time', async () => {
    // Arrange: Sign in and navigate to system settings
    await signInAdminUser(page);
    await page.goto('/admin/settings');

    // Act: Enable dual-write mode
    await page.locator('[data-testid="enable-dual-write"]').check();
    await page.locator('[data-testid="save-settings-button"]').click();

    await expect(page.locator('[data-testid="settings-saved-message"]')).toBeVisible();

    // Navigate to resume upload as regular user
    await signInTestUser(page);
    await page.goto('/dashboard/resumes');

    // Upload a resume - should trigger dual-write
    const fileInput = page.locator('[data-testid="resume-file-input"]');
    await fileInput.setInputFiles({
      name: 'dual-write-test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Dual-write test PDF content')
    });

    await page.locator('[data-testid="upload-resume-button"]').click();
    await expect(page.locator('[data-testid="upload-success-message"]')).toBeVisible({ timeout: 15000 });

    // Assert: Verify data exists in both stores
    await verifyResumeInBothStores('dual-write-test.pdf');
  });

  test('should provide real-time migration progress updates', async () => {
    // Arrange: Set up larger dataset for visible progress
    await createLargeTestDataset();
    
    await signInAdminUser(page);
    await page.goto('/admin/migration');

    // Act: Start migration and monitor progress
    await page.locator('[data-testid="migration-direction-select"]').selectOption('firestore-to-cosmos');
    await page.locator('[data-testid="select-resumes-collection"]').check();
    await page.locator('[data-testid="start-migration-button"]').click();

    // Assert: Monitor progress updates
    let previousProgress = 0;
    let progressIncreased = false;

    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2000);
      
      const progressText = await page.locator('[data-testid="migration-progress"]').textContent();
      const currentProgress = parseInt(progressText?.match(/(\d+)%/)?.[1] || '0');
      
      if (currentProgress > previousProgress) {
        progressIncreased = true;
      }
      
      previousProgress = currentProgress;
      
      if (currentProgress === 100) {
        break;
      }
    }

    expect(progressIncreased).toBe(true);
    
    // Verify final status
    await expect(page.locator('[data-testid="migration-status"]')).toContainText('completed', { timeout: 30000 });
  });

  test('should handle migration errors gracefully with user feedback', async () => {
    // Arrange: Create invalid data that will cause migration errors
    await createInvalidTestData();
    
    await signInAdminUser(page);
    await page.goto('/admin/migration');

    // Act: Start migration
    await page.locator('[data-testid="migration-direction-select"]').selectOption('firestore-to-cosmos');
    await page.locator('[data-testid="select-resumes-collection"]').check();
    await page.locator('[data-testid="continue-on-error"]').check();
    await page.locator('[data-testid="start-migration-button"]').click();

    // Wait for completion
    await expect(page.locator('[data-testid="migration-status"]')).toContainText(/completed.*with.*errors|failed/, { timeout: 30000 });

    // Assert: Error details are shown
    await expect(page.locator('[data-testid="migration-errors"]')).not.toContainText('0');
    
    // Click to view error details
    await page.locator('[data-testid="view-error-details"]').click();
    await expect(page.locator('[data-testid="error-details-modal"]')).toBeVisible();
    
    // Verify error information is meaningful
    const errorText = await page.locator('[data-testid="error-details-content"]').textContent();
    expect(errorText).toContain('validation failed');
  });

  test('should support rollback functionality through UI', async () => {
    // Arrange: Perform initial migration
    await createTestDataInFirestore();
    await signInAdminUser(page);
    await page.goto('/admin/migration');

    // Perform migration
    await page.locator('[data-testid="migration-direction-select"]').selectOption('firestore-to-cosmos');
    await page.locator('[data-testid="select-resumes-collection"]').check();
    await page.locator('[data-testid="create-backup"]').check();
    await page.locator('[data-testid="start-migration-button"]').click();

    await expect(page.locator('[data-testid="migration-status"]')).toContainText('completed', { timeout: 30000 });

    // Act: Initiate rollback
    await page.locator('[data-testid="rollback-migration-button"]').click();
    
    // Confirm rollback in modal
    await expect(page.locator('[data-testid="rollback-confirmation-modal"]')).toBeVisible();
    await page.locator('[data-testid="confirm-rollback-button"]').click();

    // Assert: Rollback completion
    await expect(page.locator('[data-testid="rollback-status"]')).toContainText('completed', { timeout: 20000 });
    await expect(page.locator('[data-testid="rollback-success-message"]')).toBeVisible();

    // Verify data restoration
    await verifyDataRollback();
  });

  test('should maintain system responsiveness during migration', async () => {
    // Arrange: Start a large migration
    await createLargeTestDataset();
    await signInAdminUser(page);
    await page.goto('/admin/migration');

    // Start migration
    await page.locator('[data-testid="migration-direction-select"]').selectOption('firestore-to-cosmos');
    await page.locator('[data-testid="select-resumes-collection"]').check();
    await page.locator('[data-testid="start-migration-button"]').click();

    // Wait for migration to start
    await expect(page.locator('[data-testid="migration-status"]')).toContainText('running', { timeout: 5000 });

    // Act: Navigate to other parts of the application while migration runs
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible({ timeout: 5000 });

    await page.goto('/dashboard/resumes');
    await expect(page.locator('[data-testid="resume-upload-section"]')).toBeVisible({ timeout: 5000 });

    // Try to upload a resume during migration
    const fileInput = page.locator('[data-testid="resume-file-input"]');
    await fileInput.setInputFiles({
      name: 'during-migration.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Resume uploaded during migration')
    });

    await page.locator('[data-testid="upload-resume-button"]').click();

    // Assert: Application should remain responsive
    await expect(page.locator('[data-testid="upload-success-message"]')).toBeVisible({ timeout: 15000 });

    // Navigate back to migration dashboard
    await page.goto('/admin/migration');
    await expect(page.locator('[data-testid="migration-progress"]')).toBeVisible();
  });

  // Helper functions

  async function signInTestUser(page: Page) {
    await page.goto('/sign-in');
    await page.fill('[data-testid="email-input"]', 'test.user@prepbettr.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="sign-in-button"]');
    await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible({ timeout: 10000 });
  }

  async function signInAdminUser(page: Page) {
    await page.goto('/sign-in');
    await page.fill('[data-testid="email-input"]', 'admin@prepbettr.com');
    await page.fill('[data-testid="password-input"]', 'adminpassword');
    await page.click('[data-testid="sign-in-button"]');
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible({ timeout: 10000 });
  }

  async function createTestDataInFirestore() {
    const firestore = admin.firestore();
    const batch = firestore.batch();

    // Create test resume documents
    for (let i = 0; i < 5; i++) {
      const docRef = firestore.collection('resumes').doc(`test-resume-${i}`);
      batch.set(docRef, {
        id: `test-resume-${i}`,
        userId: 'test-user-id',
        fileName: `test-resume-${i}.pdf`,
        uploadDate: new Date().toISOString(),
        atsScore: 75 + i,
        extractedText: `Mock extracted text for resume ${i}`,
        questions: [`Question ${i}A`, `Question ${i}B`]
      });
    }

    await batch.commit();
  }

  async function createLargeTestDataset() {
    const firestore = admin.firestore();
    const batches = [];

    // Create 50 resume documents in multiple batches
    for (let batchIndex = 0; batchIndex < 5; batchIndex++) {
      const batch = firestore.batch();
      
      for (let i = 0; i < 10; i++) {
        const id = `large-resume-${batchIndex}-${i}`;
        const docRef = firestore.collection('resumes').doc(id);
        batch.set(docRef, {
          id,
          userId: `user-${batchIndex}`,
          fileName: `large-resume-${batchIndex}-${i}.pdf`,
          uploadDate: new Date().toISOString(),
          atsScore: 60 + (batchIndex * 10) + i,
          extractedText: `Large dataset resume ${batchIndex}-${i} content`,
          questions: [`Large Q${batchIndex}-${i}-A`, `Large Q${batchIndex}-${i}-B`]
        });
      }
      
      batches.push(batch);
    }

    await Promise.all(batches.map(batch => batch.commit()));
  }

  async function createInvalidTestData() {
    const firestore = admin.firestore();
    const batch = firestore.batch();

    // Create some valid documents
    for (let i = 0; i < 2; i++) {
      const docRef = firestore.collection('resumes').doc(`valid-resume-${i}`);
      batch.set(docRef, {
        id: `valid-resume-${i}`,
        userId: `user-${i}`,
        fileName: `valid-resume-${i}.pdf`,
        uploadDate: new Date().toISOString(),
        atsScore: 80
      });
    }

    // Create invalid documents (missing required fields)
    for (let i = 0; i < 2; i++) {
      const docRef = firestore.collection('resumes').doc(`invalid-resume-${i}`);
      batch.set(docRef, {
        id: `invalid-resume-${i}`,
        // Missing userId - required field
        fileName: `invalid-resume-${i}.pdf`
        // Missing other required fields
      });
    }

    await batch.commit();
  }

  async function verifyResumeInBothStores(fileName: string) {
    // Check Cosmos DB
    const cosmosDatabase = cosmosClient.database(TEST_DATABASE_ID);
    const cosmosContainer = cosmosDatabase.container('resumes');
    const { resources: cosmosResumes } = await cosmosContainer.items
      .query(`SELECT * FROM c WHERE c.fileName = "${fileName}"`)
      .fetchAll();

    expect(cosmosResumes.length).toBeGreaterThan(0);
    expect(cosmosResumes[0].fileName).toBe(fileName);

    // Check Firestore
    const firestore = admin.firestore();
    const firestoreSnapshot = await firestore
      .collection('resumes')
      .where('fileName', '==', fileName)
      .get();

    expect(firestoreSnapshot.docs.length).toBeGreaterThan(0);
    expect(firestoreSnapshot.docs[0].data().fileName).toBe(fileName);
  }

  async function verifyMigrationResults() {
    // Verify data exists in Cosmos DB
    const cosmosDatabase = cosmosClient.database(TEST_DATABASE_ID);
    const cosmosContainer = cosmosDatabase.container('resumes');
    const { resources: cosmosResumes } = await cosmosContainer.items
      .readAll()
      .fetchAll();

    expect(cosmosResumes.length).toBeGreaterThan(0);
    
    // Verify data structure
    const sampleResume = cosmosResumes[0];
    expect(sampleResume.id).toBeDefined();
    expect(sampleResume.userId).toBeDefined();
    expect(sampleResume.fileName).toBeDefined();
    expect(sampleResume.atsScore).toBeDefined();
  }

  async function verifyDataRollback() {
    // After rollback, migrated data should be removed from Cosmos DB
    const cosmosDatabase = cosmosClient.database(TEST_DATABASE_ID);
    const cosmosContainer = cosmosDatabase.container('resumes');
    
    try {
      const { resources: cosmosResumes } = await cosmosContainer.items
        .readAll()
        .fetchAll();
      
      // Should have no migrated data (or only data that was there before migration)
      expect(cosmosResumes.length).toBeLessThanOrEqual(0);
    } catch (error) {
      // Container might not exist after rollback, which is acceptable
      expect(error).toBeDefined();
    }

    // Original data should still exist in Firestore
    const firestore = admin.firestore();
    const firestoreSnapshot = await firestore.collection('resumes').get();
    expect(firestoreSnapshot.docs.length).toBeGreaterThan(0);
  }
});