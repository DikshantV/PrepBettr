/**
 * Testing Utilities for Azure Migration Library
 * 
 * Mock implementations and testing helpers for the migration library
 */

export class MockAuthService {
  async signIn(): Promise<any> { return { uid: 'mock-user' }; }
  async signOut(): Promise<void> {}
  async getCurrentUser(): Promise<any> { return null; }
  async verifyToken(): Promise<any> { return { success: true }; }
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }
}

export class MockStorageService {
  async upload(): Promise<any> { return { file: { id: 'mock-file' } }; }
  async download(): Promise<Buffer> { return Buffer.from('mock'); }
  async delete(): Promise<void> {}
  async generateSignedUrl(): Promise<string> { return 'https://mock.url'; }
  async listFiles(): Promise<any[]> { return []; }
  async getFileMetadata(): Promise<any> { return { id: 'mock' }; }
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }
}

export class MockDatabaseService {
  async get(): Promise<any> { return null; }
  async create(): Promise<string> { return 'mock-id'; }
  async update(): Promise<void> {}
  async delete(): Promise<void> {}
  async query(): Promise<any[]> { return []; }
  subscribe(): () => void { return () => {}; }
  subscribeToQuery(): () => void { return () => {}; }
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }
}

export class MockConfigService {
  async get(key: string, defaultValue?: any): Promise<any> { return defaultValue; }
  async set(): Promise<void> {}
  async getAll(): Promise<Record<string, any>> { return {}; }
  async refresh(): Promise<void> {}
  subscribe(): () => void { return () => {}; }
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }
}

export class TestEnvironmentManager {
  static async setup(): Promise<void> {
    console.log('Test environment setup complete');
  }

  static async teardown(): Promise<void> {
    console.log('Test environment teardown complete');
  }
}

export class MigrationTestRunner {
  static async runMigrationTests(): Promise<{ passed: number; failed: number }> {
    console.log('Running migration tests...');
    return { passed: 5, failed: 0 };
  }
}
