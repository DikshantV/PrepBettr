# PrepBettr Data Layer

A comprehensive, production-ready data layer abstraction that provides seamless migration from Firestore to Azure Cosmos DB with zero-downtime dual-write capabilities, automatic consistency validation, and intelligent fallback mechanisms.

## 🎯 Overview

The data layer consolidation system addresses the need to migrate PrepBettr from Firebase Firestore to Azure Cosmos DB while maintaining:

- **Zero-downtime migration** with phased rollout
- **Data consistency** across both storage systems
- **Automatic fallback** mechanisms for reliability
- **Performance optimization** with async writes and batching
- **Comprehensive monitoring** and error handling

## 🏗 Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │    │   Data Layer     │    │   Storage       │
│    Services     │◄──►│   Abstraction    │◄──►│   Systems       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                      ┌──────────────────┐    ┌─────────────────┐
                      │ Repository Layer │    │ Firestore       │
                      │                  │    │ (Primary/Fallback) │
                      │ • CRUD Operations│    └─────────────────┘
                      │ • Query Interface│              │
                      │ • Batch Operations│              ▼
                      │ • Consistency     │    ┌─────────────────┐
                      └──────────────────┘    │ Cosmos DB       │
                                │             │ (Target/Primary) │
                                ▼             └─────────────────┘
                      ┌──────────────────┐
                      │ Migration Manager│
                      │                  │
                      │ • Dual Write     │
                      │ • Data Validation│
                      │ • Progress Track.│
                      │ • Rollback       │
                      └──────────────────┘
```

## 📦 Components

### Core Interfaces
- **IResumeDocument** & **IUsageDocument**: Data model interfaces
- **IResumeRepository** & **IUsageRepository**: Repository contracts
- **RepositoryResult**: Standardized response wrapper

### Repository Implementations
- **CosmosResumeRepository**: Azure Cosmos DB implementation
- **CosmosUsageRepository**: Usage tracking in Cosmos DB
- **FirestoreResumeRepository**: Firebase Firestore implementation

### Dual Write System
- **DualWriteRepositoryDecorator**: Core dual-write logic
- **WriteStrategy**: Controls how writes are handled
- **ReadStrategy**: Controls how reads are handled
- **Consistency Validation**: Automatic data integrity checks

### Migration Management
- **DataMigrationManager**: Orchestrates the migration process
- **Progress Tracking**: Real-time migration status
- **Validation & Rollback**: Data integrity and recovery

### Service Factory
- **DataLayerServiceFactory**: Central configuration and instance management
- **MigrationPhase**: Controlled phase transitions
- **Environment-Specific Setup**: Pre-configured setups for dev/staging/prod

## 🚀 Quick Start

### 1. Basic Setup

```typescript
import { DataLayerSetup, MigrationPhase } from '@/lib/data-layer';

// Development (Firestore only)
const dataLayer = DataLayerSetup.development();
const repositories = await dataLayer.getRepositories();

// Production (Cosmos DB only)
const dataLayer = DataLayerSetup.production({
  endpoint: process.env.COSMOS_ENDPOINT!,
  key: process.env.COSMOS_KEY!,
  databaseId: 'prepbettr'
});
```

### 2. Using Repositories

```typescript
// Get repository instances
const { resumeRepository, usageRepository } = await dataLayer.getRepositories();

// Create a resume
const resumeResult = await resumeRepository.create({
  id: 'resume_123',
  userId: 'user_456',
  fileName: 'john-doe-resume.pdf',
  uploadDate: new Date().toISOString(),
  atsScore: 85,
  skills: ['JavaScript', 'React', 'Node.js']
});

if (resumeResult.success) {
  console.log('Resume created:', resumeResult.data);
} else {
  console.error('Failed to create resume:', resumeResult.error);
}

// Query resumes
const userResumes = await resumeRepository.getResumesByUser('user_456');
const highAtsResumes = await resumeRepository.getResumesByAtsScore(80, 100);
```

### 3. Migration Process

```typescript
import { DataLayerFactory, MigrationPhase, MigrationUtils } from '@/lib/data-layer';

// Start migration
const factory = DataLayerFactory.forProduction(cosmosConfig, MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY);
const migrationManager = factory.getMigrationManager();

if (migrationManager) {
  // Start data migration
  const migrationId = await migrationManager.startMigration({
    direction: 'firestore-to-cosmos',
    collections: ['resumes', 'usage'],
    batchSize: 100,
    validateData: true,
    continueOnError: true,
    createBackup: true
  });

  // Monitor progress
  const status = await migrationManager.getMigrationStatus(migrationId);
  console.log(`Migration progress: ${status?.progressPercentage}%`);
}
```

## 🔄 Migration Phases

The system supports a controlled, phased migration approach:

### Phase 1: Firestore Only
**Current state** - All operations use Firestore
```typescript
const factory = DataLayerFactory.forDevelopment();
```

### Phase 2: Dual Write (Firestore Primary)
**Begin migration** - Write to both, read from Firestore with Cosmos DB fallback
```typescript
const factory = DataLayerFactory.forProduction(cosmosConfig, MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY);
```

### Phase 3: Dual Write with Validation
**Consistency checking** - Validate data consistency between both stores
```typescript
const factory = DataLayerFactory.forProduction(cosmosConfig, MigrationPhase.DUAL_WRITE_WITH_VALIDATION);
```

### Phase 4: Dual Write (Cosmos DB Primary)
**Switch primary** - Read from Cosmos DB, write to both
```typescript
const factory = DataLayerFactory.forProduction(cosmosConfig, MigrationPhase.DUAL_WRITE_COSMOS_PRIMARY);
```

### Phase 5: Cosmos DB Only
**Migration complete** - All operations use Cosmos DB
```typescript
const factory = DataLayerFactory.forProduction(cosmosConfig, MigrationPhase.COSMOS_DB_ONLY);
```

## 🛠 Configuration Options

### Write Strategies
- **PRIMARY_ONLY**: Write only to primary store
- **DUAL_WRITE**: Synchronous write to both stores
- **DUAL_WRITE_ASYNC**: Write to primary, async write to secondary
- **SECONDARY_ONLY**: Write only to secondary store

### Read Strategies
- **PRIMARY_ONLY**: Read from primary store only
- **SECONDARY_ONLY**: Read from secondary store only
- **PRIMARY_WITH_FALLBACK**: Read from primary, fallback to secondary
- **COMPARE_AND_RETURN_PRIMARY**: Read from both, validate consistency

### Advanced Configuration
```typescript
import { DataLayerServiceFactory, WriteStrategy, ReadStrategy } from '@/lib/data-layer';

const factory = DataLayerServiceFactory.getInstance({
  dataStore: DataStoreType.DUAL_WRITE,
  migrationPhase: MigrationPhase.DUAL_WRITE_WITH_VALIDATION,
  cosmosEndpoint: process.env.COSMOS_ENDPOINT,
  cosmosKey: process.env.COSMOS_KEY,
  cosmosDatabaseId: 'prepbettr',
  dualWriteConfig: {
    writeStrategy: WriteStrategy.DUAL_WRITE_ASYNC,
    readStrategy: ReadStrategy.PRIMARY_WITH_FALLBACK,
    validateConsistency: true,
    maxRetries: 5,
    retryDelayMs: 2000,
    asyncWriteTimeoutMs: 10000
  },
  enableConsistencyValidation: true,
  enableAsyncWrites: true,
  defaultRetryAttempts: 3
});
```

## 📊 Monitoring & Health Checks

### Health Check System
```typescript
// Perform comprehensive health check
const healthStatus = await factory.performHealthCheck();

console.log('Overall Status:', healthStatus.overall); // 'healthy' | 'degraded' | 'unhealthy'
console.log('Firestore:', healthStatus.firestore);
console.log('Cosmos DB:', healthStatus.cosmosdb);
```

### Migration Readiness Validation
```typescript
const readinessCheck = await factory.validateMigrationReadiness();

if (readinessCheck.ready) {
  console.log('System ready for migration');
} else {
  console.log('Issues found:', readinessCheck.issues);
  console.log('Recommendations:', readinessCheck.recommendations);
}
```

### Metrics Collection
```typescript
const metrics = factory.getMetrics();
console.log('Data Layer Metrics:', {
  totalOperations: metrics.totalOperations,
  successRate: (metrics.successfulOperations / metrics.totalOperations) * 100,
  inconsistencies: metrics.dualWriteInconsistencies,
  averageLatency: metrics.averageLatency
});
```

## 🔧 API Reference

### Repository Interface

```typescript
interface IResumeRepository {
  create(document: IResumeDocument): Promise<RepositoryResult<IResumeDocument>>;
  findById(id: string): Promise<RepositoryResult<IResumeDocument>>;
  findMany(query?: Record<string, any>, options?: QueryOptions): Promise<RepositoryResult<IResumeDocument[]>>;
  update(id: string, updates: Partial<IResumeDocument>): Promise<RepositoryResult<IResumeDocument>>;
  delete(id: string): Promise<RepositoryResult<boolean>>;
  count(query?: Record<string, any>): Promise<RepositoryResult<number>>;
  exists(id: string): Promise<RepositoryResult<boolean>>;
  
  // Resume-specific methods
  getResumesByUser(userId: string): Promise<RepositoryResult<IResumeDocument[]>>;
  getResumesByAtsScore(minScore: number, maxScore: number): Promise<RepositoryResult<IResumeDocument[]>>;
  searchResumes(searchTerms: string[]): Promise<RepositoryResult<IResumeDocument[]>>;
  batchCreate(documents: IResumeDocument[]): Promise<RepositoryResult<IResumeDocument[]>>;
  getStats(): Promise<RepositoryResult<any>>;
}
```

### Migration Manager Interface

```typescript
interface DataMigrationManager {
  startMigration(config: MigrationConfig): Promise<string>;
  getMigrationStatus(migrationId: string): Promise<MigrationStatus | null>;
  validateDataConsistency(options: ValidationOptions): Promise<ValidationResult>;
  verifyMigrationCompleteness(migrationId: string): Promise<CompletenessCheck>;
  rollbackMigration(migrationId: string): Promise<void>;
}
```

## 🧪 Testing

### Unit Testing
```bash
# Test repository implementations
npm run test -- lib/data-layer/cosmos/
npm run test -- lib/data-layer/firestore/

# Test dual write decorator
npm run test -- lib/data-layer/decorators/

# Test migration manager
npm run test -- lib/data-layer/migration/
```

### Integration Testing
```typescript
import { DataLayerFactory, MigrationPhase } from '@/lib/data-layer';

describe('Data Layer Integration', () => {
  it('should handle dual write operations', async () => {
    const factory = DataLayerFactory.forMigrationTesting({
      endpoint: 'test-endpoint',
      key: 'test-key',
      databaseId: 'test-db'
    });

    const { resumeRepository } = await factory.getRepositories();
    
    const result = await resumeRepository.create({
      id: 'test-resume',
      userId: 'test-user',
      fileName: 'test.pdf',
      uploadDate: new Date().toISOString()
    });

    expect(result.success).toBe(true);
  });
});
```

## 🚨 Error Handling

The data layer provides comprehensive error handling with structured error responses:

```typescript
// All repository methods return RepositoryResult
const result = await resumeRepository.create(document);

if (!result.success) {
  console.error('Operation failed:', result.error);
  
  // For dual write operations, check both results
  if ('primaryResult' in result && 'secondaryResult' in result) {
    console.log('Primary result:', result.primaryResult);
    console.log('Secondary result:', result.secondaryResult);
  }
}
```

### Common Error Scenarios
- **Connection failures**: Automatic retry with exponential backoff
- **Dual write inconsistencies**: Logged and monitored, primary takes precedence
- **Migration errors**: Detailed error tracking with rollback capabilities
- **Validation failures**: Schema validation with detailed error messages

## 🔒 Security Considerations

- **Connection strings**: Use Azure Key Vault for production credentials
- **Access control**: Implement proper IAM roles for both Firestore and Cosmos DB
- **Data encryption**: Ensure encryption at rest and in transit
- **Audit logging**: All operations are logged for security compliance

## 📈 Performance Optimization

### Batch Operations
```typescript
// Batch create multiple resumes
const documents = [/* array of resume documents */];
const result = await resumeRepository.batchCreate(documents);
```

### Query Optimization
```typescript
// Use appropriate query options
const result = await resumeRepository.findMany(
  { userId: 'user_123' },
  { 
    limit: 50, 
    orderBy: [{ field: 'uploadDate', direction: 'desc' }],
    select: ['id', 'fileName', 'atsScore'] // Only fetch needed fields
  }
);
```

### Async Operations
```typescript
// Enable async writes for better performance
const factory = DataLayerServiceFactory.getInstance({
  dataStore: DataStoreType.DUAL_WRITE,
  migrationPhase: MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY,
  enableAsyncWrites: true // Secondary writes happen asynchronously
});
```

## 🛣 Migration Roadmap

1. **Phase 0: Preparation**
   - [ ] Set up Azure Cosmos DB instance
   - [ ] Configure connection strings and credentials
   - [ ] Deploy data layer code to staging

2. **Phase 1: Dual Write Setup**
   - [ ] Enable dual write mode in staging
   - [ ] Run data consistency validation
   - [ ] Monitor performance metrics

3. **Phase 2: Migration Execution**
   - [ ] Start background data migration
   - [ ] Monitor migration progress
   - [ ] Validate data integrity

4. **Phase 3: Traffic Switching**
   - [ ] Switch read traffic to Cosmos DB
   - [ ] Monitor application performance
   - [ ] Continue dual writes for safety

5. **Phase 4: Finalization**
   - [ ] Complete data validation
   - [ ] Disable dual writes
   - [ ] Archive Firestore data

## 📚 Additional Resources

- [Azure Cosmos DB Documentation](https://docs.microsoft.com/en-us/azure/cosmos-db/)
- [Firebase Firestore Documentation](https://firebase.google.com/docs/firestore)
- [PrepBettr Architecture Guidelines](../docs/architecture.md)
- [Data Migration Best Practices](../docs/migration-guide.md)

## 🤝 Contributing

When contributing to the data layer:

1. **Follow the repository pattern**: Implement the interface contracts
2. **Add comprehensive tests**: Unit and integration tests required
3. **Document new features**: Update this README and add inline documentation
4. **Consider backward compatibility**: Ensure existing code continues to work
5. **Performance testing**: Benchmark new implementations

## 📝 License

This data layer implementation is part of the PrepBettr project and follows the same license terms.

---

For questions or support regarding the data layer implementation, please reach out to the development team or create an issue in the project repository.