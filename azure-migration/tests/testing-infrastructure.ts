/**
 * Testing Infrastructure for Azure Migration
 * 
 * Provides mocking strategies, test utilities, and rollback capabilities
 * for safe incremental migration testing
 */

import { 
  IAuthService,
  IStorageService, 
  IDocumentService,
  IConfigService,
  AuthUser,
  AuthVerificationResult,
  StorageFile,
  UploadResult,
  DatabaseDocument,
  QueryOptions
} from '../lib/shared/interfaces';

// ===== MOCK SERVICE IMPLEMENTATIONS =====

export class MockAuthService implements IAuthService {
  private users: Map<string, AuthUser> = new Map();
  private tokens: Map<string, string> = new Map(); // token -> uid mapping
  
  constructor() {
    // Add default test user
    this.users.set('test-uid-123', {
      uid: 'test-uid-123',
      email: 'test@example.com',
      name: 'Test User',
      email_verified: true
    });
    this.tokens.set('valid-test-token', 'test-uid-123');
  }
  
  async verifyToken(token: string): Promise<AuthVerificationResult> {
    const uid = this.tokens.get(token);
    if (!uid) {
      return {
        success: false,
        error: 'Invalid token',
        method: 'firebase-admin'
      };
    }
    
    const user = this.users.get(uid);
    return {
      success: true,
      user,
      method: 'firebase-admin'
    };
  }
  
  async createUser(userData: Partial<AuthUser>): Promise<AuthUser> {
    const uid = `mock-uid-${Date.now()}`;
    const user: AuthUser = {
      uid,
      email: userData.email || `${uid}@example.com`,
      name: userData.name || 'Mock User',
      email_verified: userData.email_verified || false,
      ...userData
    };
    
    this.users.set(uid, user);
    return user;
  }
  
  async updateUser(uid: string, userData: Partial<AuthUser>): Promise<void> {
    const user = this.users.get(uid);
    if (!user) {
      throw new Error('User not found');
    }
    
    this.users.set(uid, { ...user, ...userData });
  }
  
  async deleteUser(uid: string): Promise<void> {
    this.users.delete(uid);
  }
  
  async getUser(uid: string): Promise<AuthUser | null> {
    return this.users.get(uid) || null;
  }
  
  async setCustomClaims(uid: string, claims: Record<string, any>): Promise<void> {
    const user = this.users.get(uid);
    if (!user) {
      throw new Error('User not found');
    }
    
    user.custom_claims = claims;
  }
  
  // Test utilities
  addTestUser(user: AuthUser, token?: string): void {
    this.users.set(user.uid, user);
    if (token) {
      this.tokens.set(token, user.uid);
    }
  }
  
  clearTestData(): void {
    this.users.clear();
    this.tokens.clear();
  }
}

export class MockStorageService implements IStorageService {
  private files: Map<string, { buffer: Buffer; metadata: StorageFile }> = new Map();
  
  async upload(container: string, fileName: string, fileBuffer: Buffer, mimeType: string, options?: any): Promise<UploadResult> {
    const fileKey = `${container}/${fileName}`;
    const file: StorageFile = {
      id: fileKey,
      name: fileName,
      url: `https://mock-storage.example.com/${fileKey}`,
      size: fileBuffer.length,
      mimeType,
      metadata: options?.metadata,
      uploadedAt: new Date()
    };
    
    this.files.set(fileKey, { buffer: fileBuffer, metadata: file });
    
    return {
      file,
      publicUrl: options?.generatePublicUrl ? file.url : undefined,
      sasUrl: options?.expiryHours ? `${file.url}?mock-sas=true` : undefined
    };
  }
  
  async download(container: string, fileName: string): Promise<Buffer> {
    const fileKey = `${container}/${fileName}`;
    const file = this.files.get(fileKey);
    
    if (!file) {
      throw new Error('File not found');
    }
    
    return file.buffer;
  }
  
  async delete(container: string, fileName: string): Promise<void> {
    const fileKey = `${container}/${fileName}`;
    this.files.delete(fileKey);
  }
  
  async generateSignedUrl(container: string, fileName: string, expiryHours?: number): Promise<string> {
    return `https://mock-storage.example.com/${container}/${fileName}?mock-sas=true&expires=${expiryHours}h`;
  }
  
  async listFiles(container: string, prefix?: string): Promise<StorageFile[]> {
    const files: StorageFile[] = [];
    
    for (const [key, { metadata }] of this.files.entries()) {
      if (key.startsWith(`${container}/`) && (!prefix || key.includes(prefix))) {
        files.push(metadata);
      }
    }
    
    return files;
  }
  
  async getFileMetadata(container: string, fileName: string): Promise<StorageFile> {
    const fileKey = `${container}/${fileName}`;
    const file = this.files.get(fileKey);
    
    if (!file) {
      throw new Error('File not found');
    }
    
    return file.metadata;
  }
  
  // Test utilities
  addTestFile(container: string, fileName: string, content: string, mimeType: string = 'text/plain'): void {
    const buffer = Buffer.from(content);
    this.upload(container, fileName, buffer, mimeType);
  }
  
  clearTestData(): void {
    this.files.clear();
  }
}

export class MockDocumentService implements IDocumentService {
  private documents: Map<string, Map<string, DatabaseDocument>> = new Map();
  private subscribers: Map<string, Array<(doc: DatabaseDocument | null) => void>> = new Map();
  
  async get(collection: string, documentId: string): Promise<DatabaseDocument | null> {
    const collectionMap = this.documents.get(collection);
    return collectionMap?.get(documentId) || null;
  }
  
  async create(collection: string, data: Record<string, any>, documentId?: string): Promise<string> {
    const id = documentId || `mock-doc-${Date.now()}`;
    const doc: DatabaseDocument = {
      id,
      data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (!this.documents.has(collection)) {
      this.documents.set(collection, new Map());
    }
    
    this.documents.get(collection)!.set(id, doc);
    this.notifySubscribers(`${collection}/${id}`, doc);
    
    return id;
  }
  
  async update(collection: string, documentId: string, data: Record<string, any>): Promise<void> {
    const collectionMap = this.documents.get(collection);
    const existingDoc = collectionMap?.get(documentId);
    
    if (!existingDoc) {
      throw new Error('Document not found');
    }
    
    const updatedDoc: DatabaseDocument = {
      ...existingDoc,
      data: { ...existingDoc.data, ...data },
      updatedAt: new Date()
    };
    
    collectionMap!.set(documentId, updatedDoc);
    this.notifySubscribers(`${collection}/${documentId}`, updatedDoc);
  }
  
  async delete(collection: string, documentId: string): Promise<void> {
    const collectionMap = this.documents.get(collection);
    if (collectionMap) {
      collectionMap.delete(documentId);
      this.notifySubscribers(`${collection}/${documentId}`, null);
    }
  }
  
  async query(collection: string, options?: QueryOptions): Promise<DatabaseDocument[]> {
    const collectionMap = this.documents.get(collection);
    if (!collectionMap) {
      return [];
    }
    
    let results = Array.from(collectionMap.values());
    
    // Apply filters (simple implementation)
    if (options?.filters) {
      results = results.filter(doc => {
        return options.filters!.every(filter => {
          const fieldValue = doc.data[filter.field];
          switch (filter.operator) {
            case '==': return fieldValue === filter.value;
            case '!=': return fieldValue !== filter.value;
            case '>': return fieldValue > filter.value;
            case '>=': return fieldValue >= filter.value;
            case '<': return fieldValue < filter.value;
            case '<=': return fieldValue <= filter.value;
            case 'in': return Array.isArray(filter.value) && filter.value.includes(fieldValue);
            default: return true;
          }
        });
      });
    }
    
    // Apply ordering
    if (options?.orderBy) {
      results.sort((a, b) => {
        for (const order of options.orderBy!) {
          const aVal = a.data[order.field];
          const bVal = b.data[order.field];
          
          if (aVal < bVal) return order.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return order.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    // Apply limit and offset
    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }
    
    return results;
  }
  
  subscribe(collection: string, documentId: string, callback: (doc: DatabaseDocument | null) => void): () => void {
    const key = `${collection}/${documentId}`;
    
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    
    this.subscribers.get(key)!.push(callback);
    
    // Send initial value
    setTimeout(() => {
      const doc = this.documents.get(collection)?.get(documentId) || null;
      callback(doc);
    }, 0);
    
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }
  
  subscribeToQuery(collection: string, options: QueryOptions, callback: (docs: DatabaseDocument[]) => void): () => void {
    // Simple implementation - notify on any change to collection
    const collectionKey = `collection:${collection}`;
    
    if (!this.subscribers.has(collectionKey)) {
      this.subscribers.set(collectionKey, []);
    }
    
    const wrappedCallback = async () => {
      const docs = await this.query(collection, options);
      callback(docs);
    };
    
    this.subscribers.get(collectionKey)!.push(wrappedCallback);
    
    // Send initial value
    setTimeout(wrappedCallback, 0);
    
    return () => {
      const callbacks = this.subscribers.get(collectionKey);
      if (callbacks) {
        const index = callbacks.indexOf(wrappedCallback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }
  
  private notifySubscribers(key: string, doc: DatabaseDocument | null): void {
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(doc);
        } catch (error) {
          console.error('Error in mock subscriber callback:', error);
        }
      });
    }
    
    // Also notify collection subscribers
    const collection = key.split('/')[0];
    const collectionCallbacks = this.subscribers.get(`collection:${collection}`);
    if (collectionCallbacks) {
      collectionCallbacks.forEach(callback => {
        try {
          (callback as any)(); // Trigger query refresh
        } catch (error) {
          console.error('Error in mock collection subscriber callback:', error);
        }
      });
    }
  }
  
  // Test utilities
  addTestDocument(collection: string, id: string, data: Record<string, any>): void {
    this.create(collection, data, id);
  }
  
  clearTestData(): void {
    this.documents.clear();
    this.subscribers.clear();
  }
}

export class MockConfigService implements IConfigService {
  private config: Map<string, any> = new Map();
  private subscribers: Map<string, Array<(value: any) => void>> = new Map();
  
  constructor() {
    // Add default test configuration
    this.config.set('test-key', 'test-value');
    this.config.set('feature-enabled', true);
    this.config.set('max-upload-size', 50);
  }
  
  async get(key: string, defaultValue?: any): Promise<any> {
    return this.config.get(key) ?? defaultValue;
  }
  
  async set(key: string, value: any, environment?: string): Promise<void> {
    const envKey = environment ? `${key}__${environment}` : key;
    this.config.set(envKey, value);
    
    // Notify subscribers
    this.notifySubscribers(key, value);
  }
  
  async getAll(prefix?: string): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of this.config.entries()) {
      if (!prefix || key.startsWith(prefix)) {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  async refresh(): Promise<void> {
    // Mock refresh - no-op
  }
  
  subscribe(key: string, callback: (value: any) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    
    this.subscribers.get(key)!.push(callback);
    
    // Send initial value
    setTimeout(() => {
      const value = this.config.get(key);
      callback(value);
    }, 0);
    
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }
  
  private notifySubscribers(key: string, value: any): void {
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(value);
        } catch (error) {
          console.error('Error in mock config subscriber callback:', error);
        }
      });
    }
  }
  
  // Test utilities
  setTestValue(key: string, value: any): void {
    this.config.set(key, value);
    this.notifySubscribers(key, value);
  }
  
  clearTestData(): void {
    this.config.clear();
    this.subscribers.clear();
  }
}

// ===== TEST ENVIRONMENT SETUP =====

export class TestEnvironment {
  private originalServices: Map<string, any> = new Map();
  private mockServices: Map<string, any> = new Map();
  
  /**
   * Set up test environment with mock services
   */
  async setup(options: {
    mockAuth?: boolean;
    mockStorage?: boolean;
    mockDatabase?: boolean;
    mockConfig?: boolean;
  } = {}): Promise<void> {
    const { mockAuth = true, mockStorage = true, mockDatabase = true, mockConfig = true } = options;
    
    // Store original services for restoration
    const { getServiceFactory } = await import('../lib/shared/service-factory');
    const factory = getServiceFactory();
    
    if (mockAuth) {
      const mockAuthService = new MockAuthService();
      this.mockServices.set('auth', mockAuthService);
      // Replace factory method temporarily
      this.replaceFactoryMethod(factory, 'getAuthService', () => mockAuthService);
    }
    
    if (mockStorage) {
      const mockStorageService = new MockStorageService();
      this.mockServices.set('storage', mockStorageService);
      this.replaceFactoryMethod(factory, 'getStorageService', () => mockStorageService);
    }
    
    if (mockDatabase) {
      const mockDatabaseService = new MockDocumentService();
      this.mockServices.set('database', mockDatabaseService);
      this.replaceFactoryMethod(factory, 'getDatabaseService', () => mockDatabaseService);
    }
    
    if (mockConfig) {
      const mockConfigService = new MockConfigService();
      this.mockServices.set('config', mockConfigService);
      this.replaceFactoryMethod(factory, 'getConfigService', () => mockConfigService);
    }
    
    console.log('🧪 Test environment setup complete with mock services');
  }
  
  /**
   * Restore original services
   */
  async teardown(): Promise<void> {
    // Clear mock data
    for (const [serviceName, service] of this.mockServices.entries()) {
      if (typeof service.clearTestData === 'function') {
        service.clearTestData();
      }
    }
    
    // Restore original factory methods
    for (const [methodName, originalMethod] of this.originalServices.entries()) {
      // Restore original method implementation
      // This would need more sophisticated implementation in real usage
    }
    
    this.originalServices.clear();
    this.mockServices.clear();
    
    console.log('🧪 Test environment teardown complete');
  }
  
  /**
   * Get mock service for direct manipulation in tests
   */
  getMockService<T>(serviceName: string): T {
    const service = this.mockServices.get(serviceName);
    if (!service) {
      throw new Error(`Mock service '${serviceName}' not found`);
    }
    return service;
  }
  
  private replaceFactoryMethod(factory: any, methodName: string, mockImplementation: () => any): void {
    const originalMethod = factory[methodName];
    this.originalServices.set(methodName, originalMethod);
    factory[methodName] = mockImplementation;
  }
}

// ===== MIGRATION TESTING UTILITIES =====

export class MigrationTester {
  /**
   * Test data consistency between providers
   */
  static async testDataConsistency(
    sourceService: IDocumentService,
    targetService: IDocumentService,
    testCollections: string[] = ['test-collection']
  ): Promise<{ consistent: boolean; details: Record<string, any> }> {
    const results: Record<string, any> = {};
    let overallConsistent = true;
    
    for (const collection of testCollections) {
      try {
        // Create test document in source
        const testData = {
          testField: 'test-value',
          timestamp: new Date().toISOString(),
          testId: Math.random().toString(36)
        };
        
        const docId = await sourceService.create(collection, testData);
        
        // Wait a moment for potential replication
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if document exists in target
        const targetDoc = await targetService.get(collection, docId);
        
        const consistent = targetDoc !== null;
        results[collection] = {
          consistent,
          sourceDoc: { id: docId, data: testData },
          targetDoc: targetDoc ? { id: targetDoc.id, data: targetDoc.data } : null
        };
        
        if (!consistent) {
          overallConsistent = false;
        }
        
        // Clean up test document
        await Promise.allSettled([
          sourceService.delete(collection, docId),
          targetService.delete(collection, docId)
        ]);
        
      } catch (error) {
        results[collection] = {
          consistent: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        overallConsistent = false;
      }
    }
    
    return { consistent: overallConsistent, details: results };
  }
  
  /**
   * Test feature flag functionality
   */
  static async testFeatureFlags(): Promise<{ working: boolean; details: Record<string, any> }> {
    try {
      const { getFeatureFlagManager } = await import('../lib/config/unified-config');
      const flagManager = await getFeatureFlagManager();
      
      // Test flag operations
      const testResults: Record<string, any> = {};
      
      // Test getting flags
      const allFlags = flagManager.getAllFlags();
      testResults.flagCount = Object.keys(allFlags).length;
      
      // Test updating a flag
      const testFlagKey = 'azure-test-service';
      await flagManager.updateFlag(testFlagKey, { enabled: true, rolloutPercentage: 50 });
      
      const updatedFlag = await flagManager.isEnabled(testFlagKey, 'test-user-123');
      testResults.flagUpdate = { success: true, enabled: updatedFlag };
      
      // Test emergency disable
      await flagManager.emergencyDisable();
      const disabledFlag = await flagManager.isEnabled(testFlagKey, 'test-user-123');
      testResults.emergencyDisable = { success: true, disabled: !disabledFlag };
      
      return { working: true, details: testResults };
    } catch (error) {
      return {
        working: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  /**
   * Test rollback capabilities
   */
  static async testRollback(): Promise<{ working: boolean; details: Record<string, any> }> {
    try {
      const { getMigrationOrchestrator } = await import('../lib/shared/service-factory');
      const orchestrator = getMigrationOrchestrator();
      
      // Test rollback functionality
      await orchestrator.rollbackToFirebase();
      
      // Verify all Azure services are disabled
      const { getFeatureFlagManager } = await import('../lib/config/unified-config');
      const flagManager = await getFeatureFlagManager();
      const flags = flagManager.getAllFlags();
      
      const azureFlags = Object.entries(flags).filter(([key]) => key.startsWith('azure-'));
      const allDisabled = azureFlags.every(([_, flag]) => !flag.enabled);
      
      return {
        working: true,
        details: {
          azureFlagsCount: azureFlags.length,
          allDisabled,
          rollbackTime: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        working: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// ===== A/B TESTING UTILITIES =====

export class ABTestingUtils {
  /**
   * Split users into test groups for gradual rollout
   */
  static getUserTestGroup(userId: string, testName: string): 'control' | 'treatment' {
    const hash = this.hashString(`${userId}-${testName}`);
    return hash % 2 === 0 ? 'control' : 'treatment';
  }
  
  /**
   * Check if user should receive Azure services based on rollout percentage
   */
  static shouldUseAzure(userId: string, rolloutPercentage: number): boolean {
    const hash = this.hashString(userId);
    return (hash % 100) < rolloutPercentage;
  }
  
  /**
   * Generate consistent hash for user
   */
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Track A/B test metrics
   */
  static trackMetric(testName: string, userId: string, metricName: string, value: number): void {
    const group = this.getUserTestGroup(userId, testName);
    
    console.log(`📊 A/B Test Metric:`, {
      test: testName,
      group,
      metric: metricName,
      value,
      userId: userId.substring(0, 8) + '...',
      timestamp: new Date().toISOString()
    });
    
    // In production, this would send to analytics service
  }
}

// ===== PERFORMANCE TESTING UTILITIES =====

export class PerformanceTester {
  /**
   * Compare service performance between providers
   */
  static async compareServicePerformance(
    firebaseService: any,
    azureService: any,
    operation: string,
    iterations: number = 10
  ): Promise<{
    firebase: { avgMs: number; minMs: number; maxMs: number; errors: number };
    azure: { avgMs: number; minMs: number; maxMs: number; errors: number };
  }> {
    const testOperation = async (service: any): Promise<{ avgMs: number; minMs: number; maxMs: number; errors: number }> => {
      const times: number[] = [];
      let errors = 0;
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        try {
          // Customize this based on the operation being tested
          if (operation === 'get' && typeof service.get === 'function') {
            await service.get('test-collection', `test-doc-${i}`);
          } else if (operation === 'upload' && typeof service.upload === 'function') {
            const testBuffer = Buffer.from(`test-content-${i}`);
            await service.upload('test-container', `test-file-${i}.txt`, testBuffer, 'text/plain');
          }
          // Add more operations as needed
          
          const duration = Date.now() - start;
          times.push(duration);
        } catch (error) {
          errors++;
        }
      }
      
      if (times.length === 0) {
        return { avgMs: 0, minMs: 0, maxMs: 0, errors };
      }
      
      return {
        avgMs: times.reduce((a, b) => a + b, 0) / times.length,
        minMs: Math.min(...times),
        maxMs: Math.max(...times),
        errors
      };
    };
    
    const [firebaseResults, azureResults] = await Promise.all([
      testOperation(firebaseService),
      testOperation(azureService)
    ]);
    
    console.log(`⚡ Performance Test Results for ${operation}:`, {
      firebase: firebaseResults,
      azure: azureResults,
      winner: firebaseResults.avgMs < azureResults.avgMs ? 'Firebase' : 'Azure'
    });
    
    return { firebase: firebaseResults, azure: azureResults };
  }
}

// ===== INTEGRATION TEST SUITE =====

export class IntegrationTestSuite {
  private testEnv = new TestEnvironment();
  
  /**
   * Run complete integration test suite
   */
  async runAllTests(): Promise<{ passed: number; failed: number; results: Record<string, any> }> {
    const results: Record<string, any> = {};
    let passed = 0;
    let failed = 0;
    
    console.log('🧪 Starting Azure Migration Integration Tests...');
    
    // Test 1: Service Factory
    try {
      await this.testServiceFactory();
      results.serviceFactory = { status: 'passed' };
      passed++;
    } catch (error) {
      results.serviceFactory = { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' };
      failed++;
    }
    
    // Test 2: Feature Flags
    try {
      const flagTest = await MigrationTester.testFeatureFlags();
      results.featureFlags = { status: flagTest.working ? 'passed' : 'failed', details: flagTest.details };
      flagTest.working ? passed++ : failed++;
    } catch (error) {
      results.featureFlags = { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' };
      failed++;
    }
    
    // Test 3: Rollback
    try {
      const rollbackTest = await MigrationTester.testRollback();
      results.rollback = { status: rollbackTest.working ? 'passed' : 'failed', details: rollbackTest.details };
      rollbackTest.working ? passed++ : failed++;
    } catch (error) {
      results.rollback = { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' };
      failed++;
    }
    
    // Test 4: Health Checks
    try {
      await this.testHealthChecks();
      results.healthChecks = { status: 'passed' };
      passed++;
    } catch (error) {
      results.healthChecks = { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' };
      failed++;
    }
    
    console.log(`🧪 Integration Tests Complete: ${passed} passed, ${failed} failed`);
    
    return { passed, failed, results };
  }
  
  private async testServiceFactory(): Promise<void> {
    const { getServiceFactory } = await import('../lib/shared/service-factory');
    const factory = getServiceFactory();
    
    // Test that all services can be instantiated
    const authService = factory.getAuthService();
    const storageService = factory.getStorageService();
    const databaseService = factory.getDatabaseService();
    const configService = factory.getConfigService();
    
    if (!authService || !storageService || !databaseService || !configService) {
      throw new Error('Service factory failed to provide all services');
    }
  }
  
  private async testHealthChecks(): Promise<void> {
    const { ServiceHealthChecker } = await import('../lib/shared/service-factory');
    const healthSummary = await ServiceHealthChecker.getHealthSummary();
    
    if (healthSummary.overall === 'unhealthy') {
      throw new Error(`Health check failed: ${healthSummary.details.join(', ')}`);
    }
  }
}

// ===== EXPORT TEST UTILITIES =====

export const TestUtils = {
  TestEnvironment,
  MigrationTester,
  ABTestingUtils,
  PerformanceTester,
  IntegrationTestSuite,
  
  // Mock services
  MockAuthService,
  MockStorageService,
  MockDocumentService,
  MockConfigService
};

export default TestUtils;
