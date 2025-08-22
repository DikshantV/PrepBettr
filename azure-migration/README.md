# Azure Migration Library

A comprehensive, provider-agnostic library for migrating Firebase applications to Azure services with zero downtime and rollback capabilities.

## Features

🚀 **Zero-Downtime Migration**: Gradual rollout with feature flags  
🔄 **Bidirectional Sync**: Keep Firebase and Azure in sync during migration  
🛡️ **Automatic Fallback**: Falls back to Firebase if Azure services fail  
📊 **Health Monitoring**: Real-time health checks and monitoring  
🎯 **A/B Testing**: Percentage-based user rollout  
⚡ **Emergency Rollback**: One-command rollback to Firebase  
🧪 **Comprehensive Testing**: Mock services and test utilities included  

## Quick Start

### Installation

```bash
npm install azure-migration
```

### Basic Setup

```typescript
import { setupMigration, getStorageService, getDatabaseService } from 'azure-migration';

// Initialize migration (development environment, Azure disabled initially)
await setupMigration({
  environment: 'development',
  enableAzure: false
});

// Use services (will use Firebase initially)
const storage = getStorageService();
const database = getDatabaseService();

// Your existing code works unchanged!
const file = await storage.upload('container', 'file.pdf', buffer, 'application/pdf');
const user = await database.get('users', userId);
```

### Enable Azure Gradually

```typescript
import { getFeatureFlagManager } from 'azure-migration';

const flagManager = await getFeatureFlagManager();

// Start with 10% of traffic to Azure
await flagManager.setFlag('storage_azure_rollout', { enabled: true, percentage: 10 });
```

## Architecture

The library provides a unified service layer that abstracts away the differences between Firebase and Azure:

```
Your Application Code
        ↓
Unified Service Factory
        ↓
┌─────────────────┬─────────────────┐
│ Firebase        │ Azure           │
│ Adapters        │ Services        │
│                 │                 │
│ • Auth          │ • Azure AD      │
│ • Storage       │ • Blob Storage  │
│ • Firestore     │ • Cosmos DB     │
│ • Remote Config │ • App Config    │
└─────────────────┴─────────────────┘
```

## Service Mapping

| Firebase Service | Azure Equivalent | Migration Status |
|-----------------|------------------|------------------|
| Firebase Auth | Azure AD B2C | ✅ Adapter Ready |
| Cloud Storage | Blob Storage | ✅ Full Migration |
| Firestore | Cosmos DB | ✅ Full Migration |
| Remote Config | App Configuration | ✅ Full Migration |
| Cloud Functions | Azure Functions | 🚧 Different Pattern |

## Usage Examples

### Storage Service

```typescript
import { getStorageService } from 'azure-migration';

const storage = getStorageService();

// Upload file (automatically uses Firebase or Azure based on feature flags)
const result = await storage.upload('documents', 'resume.pdf', fileBuffer, 'application/pdf');

// Download file (with automatic fallback)
const fileData = await storage.download('documents', 'resume.pdf');

// Generate signed URL
const signedUrl = await storage.generateSignedUrl('documents', 'resume.pdf', 24);
```

### Database Service

```typescript
import { getDatabaseService } from 'azure-migration';

const database = getDatabaseService();

// Create document (provider automatically selected)
const docId = await database.create('users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Query with filters
const users = await database.query('users', {
  filters: [
    { field: 'status', operator: '==', value: 'active' }
  ],
  orderBy: [
    { field: 'createdAt', direction: 'desc' }
  ],
  limit: 10
});

// Real-time subscription (always uses Firebase for optimal performance)
const unsubscribe = database.subscribe('users', userId, (user) => {
  console.log('User updated:', user);
});
```

### Configuration Service

```typescript
import { getConfigService } from 'azure-migration';

const config = getConfigService();

// Get configuration value
const maxFileSize = await config.get('max_file_size', { value: 10485760, type: 'number' });

// Subscribe to configuration changes
const unsubscribe = config.subscribe('max_file_size', (value) => {
  console.log('Max file size updated:', value);
});
```

## Migration Process

### 1. Setup Phase

```typescript
// Install and configure
await setupMigration({
  environment: 'production',
  enableAzure: true,
  azureRolloutPercentage: 0  // Start with 0% Azure traffic
});
```

### 2. Data Migration

```typescript
import { getMigrationOrchestrator } from 'azure-migration';

const orchestrator = getMigrationOrchestrator();

// Migrate storage
await orchestrator.migrateStorage({
  containers: ['resumes', 'documents'],
  dryRun: false
});

// Migrate database
await orchestrator.migrateDatabase({
  collections: ['users', 'interviews'],
  dryRun: false
});
```

### 3. Gradual Rollout

```typescript
const flagManager = await getFeatureFlagManager();

// Week 1: 10% traffic
await flagManager.setFlag('storage_azure_rollout', { enabled: true, percentage: 10 });

// Week 2: 25% traffic
await flagManager.setFlag('storage_azure_rollout', { enabled: true, percentage: 25 });

// Week 3: 50% traffic
await flagManager.setFlag('storage_azure_rollout', { enabled: true, percentage: 50 });

// Week 4: 100% traffic
await flagManager.setFlag('storage_azure_rollout', { enabled: true, percentage: 100 });
```

## Health Monitoring

### Real-time Health Checks

```typescript
import { ServiceHealthChecker, checkMigrationHealth } from 'azure-migration';

// Quick health summary
const health = await checkMigrationHealth();
console.log('Migration Health:', health.overall);

// Detailed health check
const detailedHealth = await ServiceHealthChecker.checkAllServices();
console.log('Service Details:', detailedHealth);
```

### Automated Monitoring

```typescript
// Set up automated health monitoring
setInterval(async () => {
  const health = await checkMigrationHealth();
  
  if (health.overall !== 'healthy') {
    console.warn('⚠️ Service degradation detected');
    // Trigger alerts, notifications, etc.
  }
}, 30000);
```

## Emergency Procedures

### Emergency Rollback

```typescript
import { emergencyRollback } from 'azure-migration';

// One-command rollback to Firebase
await emergencyRollback();
```

### Selective Rollback

```typescript
const flagManager = await getFeatureFlagManager();

// Rollback just storage
await flagManager.setFlag('storage_azure_rollout', { enabled: false, percentage: 0 });

// Rollback just database
await flagManager.setFlag('database_azure_rollout', { enabled: false, percentage: 0 });
```

## Testing

### Mock Services for Testing

```typescript
import { MockStorageService, TestEnvironmentManager } from 'azure-migration/testing';

// Set up test environment
const testEnv = new TestEnvironmentManager();
await testEnv.setup({
  provider: 'mock',
  seedData: true
});

// Use mock services in tests
const mockStorage = new MockStorageService();
await mockStorage.upload('test-container', 'test-file', buffer, 'text/plain');
```

### Migration Testing

```typescript
import { MigrationTestRunner } from 'azure-migration/testing';

const testRunner = new MigrationTestRunner();

// Test data consistency between providers
await testRunner.runConsistencyTests();

// Test rollback procedures
await testRunner.runRollbackTests();
```

## Configuration

### Environment Variables

```bash
# Azure Configuration
AZURE_STORAGE_ACCOUNT_NAME=your_storage_account
AZURE_STORAGE_ACCOUNT_KEY=your_storage_key
AZURE_COSMOS_ENDPOINT=https://your-cosmos.documents.azure.com:443/
AZURE_COSMOS_KEY=your_cosmos_key
AZURE_APP_CONFIG_CONNECTION_STRING=your_connection_string

# Feature Flags
ENABLE_AZURE_MIGRATION=true
AZURE_ROLLOUT_PERCENTAGE=10
```

### Feature Flags

| Flag Name | Description | Default |
|-----------|-------------|----------|
| `storage_azure_rollout` | Percentage of storage operations using Azure | 0% |
| `database_azure_rollout` | Percentage of database operations using Azure | 0% |
| `config_azure_rollout` | Percentage of config operations using Azure | 0% |
| `enable_firebase_fallback` | Enable fallback to Firebase on Azure failures | true |

## Migration Timeline

| Phase | Duration | Activities | Azure Traffic |
|-------|----------|------------|---------------|
| **Setup** | Week 1 | Code integration, Firebase adapters | 0% |
| **Infrastructure** | Week 2 | Azure provisioning, configuration | 0% |
| **Storage Migration** | Week 3 | Data sync, gradual rollout | 0% → 50% |
| **Database Migration** | Week 4-5 | Data sync, gradual rollout | 0% → 35% |
| **Config Migration** | Week 6 | Config sync, gradual rollout | 0% → 90% |
| **Completion** | Week 7 | Full rollout, validation | 100% |

## Best Practices

### 1. Always Test First

- Start with development environment
- Use dry-run options for data migration
- Validate with small traffic percentages

### 2. Monitor Continuously

- Set up health check dashboards
- Monitor error rates and performance
- Use gradual rollout to catch issues early

### 3. Have Rollback Ready

- Test rollback procedures regularly
- Keep Firebase services active during migration
- Monitor both providers simultaneously

### 4. Data Consistency

- Validate data integrity after each migration step
- Use bidirectional sync during transition period
- Set up automated consistency checks

## Support

- **Documentation**: See `MIGRATION_GUIDE.md` for detailed procedures
- **Testing**: Run `npm test` for comprehensive test suite
- **Health Checks**: Run `npm run health-check` for service status
- **Migration Scripts**: Run `npm run migrate` for automated migration

## License

MIT License - see LICENSE file for details.
