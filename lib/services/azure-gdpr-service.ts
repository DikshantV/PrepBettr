import { CosmosClient, Container, Database } from '@azure/cosmos';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

/**
 * Azure-based GDPR Compliance Service
 * 
 * Implements GDPR features using Azure Cosmos DB for data deletion requests
 * and audit logging, plus Azure Blob Storage for file deletion.
 */

export interface UserConsent {
  id: string;
  userId: string;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  consentDate: string;
  ipAddress?: string;
  userAgent?: string;
  version: string; // Privacy policy version
  lastUpdated: string;
  partitionKey: string; // For Cosmos DB partitioning
}

export interface DataDeletionRequest {
  id: string;
  userId: string;
  requestDate: string;
  requestedBy: string; // email of person making request
  reason?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  scheduledDate?: string; // When deletion will be processed (30 days after request)
  completedDate?: string;
  deletedData: string[]; // list of containers/collections deleted
  errors?: string[]; // any errors encountered during deletion
  auditTrail: AuditLogEntry[];
  partitionKey: string; // For Cosmos DB partitioning
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: 'consent_recorded' | 'consent_updated' | 'data_deletion_requested' | 'data_deletion_processed' | 'data_exported' | 'data_anonymized';
  timestamp: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  complianceOfficer?: string;
  partitionKey: string;
}

export interface AnonymizedAnalytics {
  id: string;
  timestamp: string;
  event: string;
  page: string;
  userId: string; // hashed/pseudonymized
  sessionId: string; // hashed
  userAgent?: string; // anonymized
  location?: {
    country: string;
    region?: string;
  };
  metadata: Record<string, any>;
  partitionKey: string;
}

export class AzureGDPRService {
  private cosmosClient: CosmosClient | null = null;
  private database: Database | null = null;
  private blobServiceClient: BlobServiceClient | null = null;
  private keyVaultClient: SecretClient | null = null;
  private static instance: AzureGDPRService;
  
  private readonly COSMOS_DATABASE_ID = 'PrepBettrDB';
  private readonly CONTAINERS = {
    DELETION_REQUESTS: 'gdprRequests',
    AUDIT_LOG: 'dataProtectionAuditLog',
    CONSENTS: 'userConsents',
    ANONYMIZED_ANALYTICS: 'anonymizedAnalytics'
  } as const;

  public static getInstance(): AzureGDPRService {
    if (!AzureGDPRService.instance) {
      AzureGDPRService.instance = new AzureGDPRService();
    }
    return AzureGDPRService.instance;
  }

  /**
   * Initialize Azure services (Cosmos DB, Blob Storage, Key Vault)
   */
  async initialize(): Promise<void> {
    try {
      // Initialize Azure Key Vault for secrets
      if (process.env.AZURE_KEY_VAULT_URL) {
        this.keyVaultClient = new SecretClient(
          process.env.AZURE_KEY_VAULT_URL,
          new DefaultAzureCredential()
        );
      }

      // Initialize Cosmos DB
      await this.initializeCosmosDB();
      
      // Initialize Blob Storage
      await this.initializeBlobStorage();

      console.log('✅ Azure GDPR Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Azure GDPR Service:', error);
      throw error;
    }
  }

  private async initializeCosmosDB(): Promise<void> {
    try {
      let connectionString = process.env.AZURE_COSMOS_CONNECTION_STRING;
      
      // Try to get connection string from Key Vault if not in env
      if (!connectionString && this.keyVaultClient) {
        try {
          const secret = await this.keyVaultClient.getSecret('cosmos-db-connection-string');
          connectionString = secret.value;
        } catch (keyVaultError) {
          console.warn('Could not retrieve Cosmos DB connection from Key Vault:', keyVaultError);
        }
      }

      // Fallback to endpoint and key
      if (!connectionString) {
        const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
        const key = process.env.AZURE_COSMOS_KEY;
        
        if (!endpoint || !key) {
          throw new Error('Cosmos DB configuration missing. Provide either AZURE_COSMOS_CONNECTION_STRING or both AZURE_COSMOS_ENDPOINT and AZURE_COSMOS_KEY');
        }
        
        this.cosmosClient = new CosmosClient({ endpoint, key });
      } else {
        this.cosmosClient = new CosmosClient(connectionString);
      }

      // Get database reference
      this.database = this.cosmosClient.database(this.COSMOS_DATABASE_ID);
      
      // Ensure containers exist
      await this.ensureContainers();
      
      console.log('✅ Cosmos DB initialized for GDPR service');
    } catch (error) {
      console.error('❌ Failed to initialize Cosmos DB:', error);
      throw error;
    }
  }

  private async initializeBlobStorage(): Promise<void> {
    try {
      let connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      
      // Try to get connection string from Key Vault
      if (!connectionString && this.keyVaultClient) {
        try {
          const secret = await this.keyVaultClient.getSecret('storage-connection-string');
          connectionString = secret.value;
        } catch (keyVaultError) {
          console.warn('Could not retrieve Storage connection from Key Vault:', keyVaultError);
        }
      }

      if (!connectionString) {
        throw new Error('Azure Storage connection string not found in environment or Key Vault');
      }

      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      
      console.log('✅ Azure Blob Storage initialized for GDPR service');
    } catch (error) {
      console.error('❌ Failed to initialize Blob Storage:', error);
      throw error;
    }
  }

  private async ensureContainers(): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    for (const [containerName, containerId] of Object.entries(this.CONTAINERS)) {
      try {
        await this.database.containers.createIfNotExists({
          id: containerId,
          partitionKey: { paths: ['/partitionKey'] }
        });
        console.log(`✅ Container ${containerId} ready`);
      } catch (error) {
        console.error(`❌ Failed to create container ${containerId}:`, error);
      }
    }
  }

  /**
   * Record user consent with audit trail
   */
  async recordConsent(consent: Omit<UserConsent, 'id' | 'partitionKey' | 'lastUpdated'>): Promise<string> {
    if (!this.database) await this.initialize();

    try {
      const consentId = `consent_${consent.userId}_${Date.now()}`;
      const consentRecord: UserConsent = {
        id: consentId,
        ...consent,
        lastUpdated: new Date().toISOString(),
        partitionKey: consent.userId
      };

      const container = this.database!.container(this.CONTAINERS.CONSENTS);
      await container.items.create(consentRecord);

      // Create audit log entry
      await this.createAuditLogEntry({
        userId: consent.userId,
        action: 'consent_recorded',
        details: {
          analytics: consent.analytics,
          marketing: consent.marketing,
          functional: consent.functional,
          version: consent.version
        },
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent
      });

      console.log(`✅ Consent recorded for user ${consent.userId}`);
      return consentId;
    } catch (error) {
      console.error('❌ Failed to record consent:', error);
      throw new Error('Failed to record user consent');
    }
  }

  /**
   * Get latest user consent
   */
  async getConsent(userId: string): Promise<UserConsent | null> {
    if (!this.database) await this.initialize();

    try {
      const container = this.database!.container(this.CONTAINERS.CONSENTS);
      const query = {
        query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.lastUpdated DESC',
        parameters: [{ name: '@userId', value: userId }]
      };

      const { resources } = await container.items.query<UserConsent>(query, {
        maxItemCount: 1,
        partitionKey: userId
      }).fetchNext();

      return resources.length > 0 ? resources[0] : null;
    } catch (error) {
      console.error('❌ Failed to get consent:', error);
      throw new Error('Failed to retrieve user consent');
    }
  }

  /**
   * Update user consent
   */
  async updateConsent(userId: string, updates: Partial<UserConsent>): Promise<void> {
    if (!this.database) await this.initialize();

    try {
      const currentConsent = await this.getConsent(userId);
      if (!currentConsent) {
        throw new Error('No existing consent found for user');
      }

      const updatedConsent: UserConsent = {
        ...currentConsent,
        ...updates,
        lastUpdated: new Date().toISOString()
      };

      const container = this.database!.container(this.CONTAINERS.CONSENTS);
      await container.item(currentConsent.id, userId).replace(updatedConsent);

      // Create audit log entry
      await this.createAuditLogEntry({
        userId,
        action: 'consent_updated',
        details: { updates }
      });

      console.log(`✅ Consent updated for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to update consent:', error);
      throw new Error('Failed to update user consent');
    }
  }

  /**
   * Request data deletion (GDPR Right to Erasure)
   */
  async requestDataDeletion(
    userId: string,
    requestedBy: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    if (!this.database) await this.initialize();

    try {
      const requestId = `del_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const requestDate = new Date();
      const scheduledDate = new Date(requestDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now

      const deletionRequest: DataDeletionRequest = {
        id: requestId,
        userId,
        requestDate: requestDate.toISOString(),
        requestedBy,
        reason,
        status: 'pending',
        scheduledDate: scheduledDate.toISOString(),
        deletedData: [],
        auditTrail: [],
        partitionKey: userId
      };

      const container = this.database!.container(this.CONTAINERS.DELETION_REQUESTS);
      await container.items.create(deletionRequest);

      // Create audit log entry
      await this.createAuditLogEntry({
        userId,
        action: 'data_deletion_requested',
        details: {
          requestId,
          requestedBy,
          reason,
          scheduledDate: scheduledDate.toISOString()
        },
        ipAddress,
        userAgent
      });

      console.log(`✅ Data deletion requested for user ${userId}, scheduled for ${scheduledDate.toDateString()}`);
      return requestId;
    } catch (error) {
      console.error('❌ Failed to request data deletion:', error);
      throw new Error('Failed to request data deletion');
    }
  }

  /**
   * Process data deletion (called by scheduled Azure Function)
   */
  async processDataDeletion(requestId: string): Promise<{ success: boolean; deletedData: string[]; errors: string[] }> {
    if (!this.database) await this.initialize();

    try {
      const container = this.database!.container(this.CONTAINERS.DELETION_REQUESTS);
      const { resource: request } = await container.item(requestId, requestId).read<DataDeletionRequest>();

      if (!request) {
        throw new Error('Deletion request not found');
      }

      if (request.status !== 'pending') {
        throw new Error(`Cannot process request with status: ${request.status}`);
      }

      // Update status to processing
      await container.item(requestId, request.partitionKey).patch([
        { op: 'replace', path: '/status', value: 'processing' }
      ]);

      const deletedData: string[] = [];
      const errors: string[] = [];

      // Delete from Cosmos DB containers
      const containersToDelete = [
        'users',
        'profiles', 
        'resumes',
        'interviews',
        'feedback',
        'usage',
        'notifications',
        'emailVerifications'
      ];

      for (const containerName of containersToDelete) {
        try {
          const deleted = await this.deleteFromContainer(containerName, request.userId);
          if (deleted > 0) {
            deletedData.push(`${containerName} (${deleted} items)`);
          }
        } catch (error) {
          const errorMsg = `Failed to delete from ${containerName}: ${error}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      // Delete from Azure Blob Storage
      try {
        const deletedBlobContainers = await this.deleteFromBlobStorage(request.userId);
        if (deletedBlobContainers.length > 0) {
          deletedData.push(`blob-storage (${deletedBlobContainers.join(', ')})`);
        }
      } catch (error) {
        const errorMsg = `Failed to delete from blob storage: ${error}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }

      // Update request with results
      const finalStatus = errors.length > 0 ? 'completed' : 'completed'; // Still completed even with some errors
      await container.item(requestId, request.partitionKey).patch([
        { op: 'replace', path: '/status', value: finalStatus },
        { op: 'replace', path: '/completedDate', value: new Date().toISOString() },
        { op: 'replace', path: '/deletedData', value: deletedData },
        { op: 'replace', path: '/errors', value: errors }
      ]);

      // Create audit log entry
      await this.createAuditLogEntry({
        userId: request.userId,
        action: 'data_deletion_processed',
        details: {
          requestId,
          deletedData,
          errors,
          status: finalStatus
        },
        complianceOfficer: 'system'
      });

      console.log(`✅ Data deletion processed for user ${request.userId}`);
      console.log(`   Deleted: ${deletedData.join(', ')}`);
      if (errors.length > 0) {
        console.log(`   Errors: ${errors.join(', ')}`);
      }

      return { success: errors.length === 0, deletedData, errors };
    } catch (error) {
      console.error('❌ Failed to process data deletion:', error);
      
      // Update request status to failed
      try {
        const container = this.database!.container(this.CONTAINERS.DELETION_REQUESTS);
        await container.item(requestId, requestId).patch([
          { op: 'replace', path: '/status', value: 'failed' },
          { op: 'replace', path: '/errors', value: [error instanceof Error ? error.message : 'Unknown error'] }
        ]);
      } catch (updateError) {
        console.error('❌ Failed to update request status to failed:', updateError);
      }

      throw error;
    }
  }

  /**
   * Get pending deletion requests that are ready for processing
   */
  async getPendingDeletions(): Promise<DataDeletionRequest[]> {
    if (!this.database) await this.initialize();

    try {
      const container = this.database!.container(this.CONTAINERS.DELETION_REQUESTS);
      const now = new Date().toISOString();
      
      const query = {
        query: 'SELECT * FROM c WHERE c.status = @status AND c.scheduledDate <= @now',
        parameters: [
          { name: '@status', value: 'pending' },
          { name: '@now', value: now }
        ]
      };

      const { resources } = await container.items.query<DataDeletionRequest>(query).fetchAll();
      return resources;
    } catch (error) {
      console.error('❌ Failed to get pending deletions:', error);
      throw error;
    }
  }

  /**
   * Get deletion request status
   */
  async getDeletionRequestStatus(requestId: string): Promise<DataDeletionRequest | null> {
    if (!this.database) await this.initialize();

    try {
      const container = this.database!.container(this.CONTAINERS.DELETION_REQUESTS);
      const { resource } = await container.item(requestId, requestId).read<DataDeletionRequest>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null; // Request not found
      }
      console.error('❌ Failed to get deletion request status:', error);
      throw error;
    }
  }

  /**
   * Export user data (GDPR Subject Access Request)
   */
  async exportUserData(userId: string): Promise<any> {
    if (!this.database) await this.initialize();

    try {
      const exportData: any = {
        userId,
        exportDate: new Date().toISOString(),
        data: {}
      };

      // Export from Cosmos DB containers
      const containersToExport = ['users', 'profiles', 'resumes', 'interviews', 'usage'];
      
      for (const containerName of containersToExport) {
        try {
          const containerClient = this.database!.container(containerName);
          const query = {
            query: 'SELECT * FROM c WHERE c.userId = @userId',
            parameters: [{ name: '@userId', value: userId }]
          };

          const { resources } = await containerClient.items.query(query, {
            partitionKey: userId
          }).fetchAll();

          if (resources.length > 0) {
            exportData.data[containerName] = resources;
          }
        } catch (error) {
          console.warn(`Failed to export from ${containerName}:`, error);
        }
      }

      // Export consent data
      const consent = await this.getConsent(userId);
      if (consent) {
        exportData.data.consents = consent;
      }

      // Export audit logs related to this user
      const auditLogs = await this.getAuditLogs(userId);
      if (auditLogs.length > 0) {
        exportData.data.auditLogs = auditLogs;
      }

      // Create audit log entry for data export
      await this.createAuditLogEntry({
        userId,
        action: 'data_exported',
        details: {
          exportedContainers: Object.keys(exportData.data),
          totalRecords: Object.values(exportData.data).flat().length
        }
      });

      console.log(`✅ User data exported for ${userId}`);
      return exportData;
    } catch (error) {
      console.error('❌ Failed to export user data:', error);
      throw new Error('Failed to export user data');
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLogEntry(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'partitionKey'>): Promise<void> {
    if (!this.database) return;

    try {
      const auditEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        timestamp: new Date().toISOString(),
        partitionKey: entry.userId,
        ...entry
      };

      const container = this.database.container(this.CONTAINERS.AUDIT_LOG);
      await container.items.create(auditEntry);
    } catch (error) {
      console.error('❌ Failed to create audit log entry:', error);
      // Don't throw - audit logging failure shouldn't stop the main operation
    }
  }

  /**
   * Get audit logs for a user
   */
  async getAuditLogs(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    if (!this.database) await this.initialize();

    try {
      const container = this.database!.container(this.CONTAINERS.AUDIT_LOG);
      const query = {
        query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.timestamp DESC',
        parameters: [{ name: '@userId', value: userId }]
      };

      const { resources } = await container.items.query<AuditLogEntry>(query, {
        maxItemCount: limit,
        partitionKey: userId
      }).fetchNext();

      return resources;
    } catch (error) {
      console.error('❌ Failed to get audit logs:', error);
      throw error;
    }
  }

  /**
   * Delete user data from a specific Cosmos DB container
   */
  private async deleteFromContainer(containerName: string, userId: string): Promise<number> {
    if (!this.database) return 0;

    try {
      const container = this.database.container(containerName);
      const query = {
        query: 'SELECT c.id FROM c WHERE c.userId = @userId',
        parameters: [{ name: '@userId', value: userId }]
      };

      const { resources: items } = await container.items.query(query, {
        partitionKey: userId
      }).fetchAll();

      let deletedCount = 0;
      
      // Delete in batches to avoid overwhelming the database
      const batchSize = 25;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const deletePromises = batch.map(item => 
          container.item(item.id, userId).delete().catch(error => {
            console.warn(`Failed to delete item ${item.id} from ${containerName}:`, error);
            return null;
          })
        );
        
        const results = await Promise.all(deletePromises);
        deletedCount += results.filter(result => result !== null).length;
      }

      return deletedCount;
    } catch (error) {
      console.error(`❌ Error deleting from container ${containerName}:`, error);
      throw error;
    }
  }

  /**
   * Delete user files from Azure Blob Storage
   */
  private async deleteFromBlobStorage(userId: string): Promise<string[]> {
    if (!this.blobServiceClient) return [];

    const deletedContainers: string[] = [];
    const userContainers = ['user-files', 'resumes', 'profile-pics', 'documents'];

    for (const containerName of userContainers) {
      try {
        const containerClient = this.blobServiceClient.getContainerClient(containerName);
        const prefix = `users/${userId}/`;
        
        let deletedBlobs = 0;
        for await (const blob of containerClient.listBlobsFlat({ prefix })) {
          try {
            await containerClient.deleteBlob(blob.name);
            deletedBlobs++;
          } catch (error) {
            console.warn(`Failed to delete blob ${blob.name}:`, error);
          }
        }

        if (deletedBlobs > 0) {
          deletedContainers.push(`${containerName} (${deletedBlobs} files)`);
        }
      } catch (error) {
        console.warn(`Failed to access blob container ${containerName}:`, error);
      }
    }

    return deletedContainers;
  }

  /**
   * Anonymize analytics data for GDPR compliance
   */
  anonymizeAnalyticsData(data: {
    userId: string;
    sessionId: string;
    event: string;
    page: string;
    metadata?: Record<string, any>;
  }): AnonymizedAnalytics {
    return {
      id: `anon_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      timestamp: new Date().toISOString(),
      event: data.event,
      page: data.page,
      userId: this.hashUserId(data.userId),
      sessionId: this.hashSessionId(data.sessionId),
      metadata: this.sanitizeMetadata(data.metadata || {}),
      partitionKey: 'anonymized'
    };
  }

  /**
   * Privacy utility methods
   */
  maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1)
      : '*'.repeat(username.length);
    return `${maskedUsername}@${domain}`;
  }

  maskPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length > 4) {
      return cleaned.substring(0, 3) + '*'.repeat(cleaned.length - 6) + cleaned.substring(cleaned.length - 3);
    }
    return '*'.repeat(cleaned.length);
  }

  private hashUserId(userId: string): string {
    return Buffer.from(userId + 'salt').toString('base64').substring(0, 12);
  }

  private hashSessionId(sessionId: string): string {
    return Buffer.from(sessionId + 'salt').toString('base64').substring(0, 8);
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };
    
    // Remove potential PII from metadata
    const piiKeys = ['email', 'phone', 'name', 'address', 'ssn', 'creditCard', 'userId'];
    piiKeys.forEach(key => {
      if (sanitized[key]) {
        delete sanitized[key];
      }
    });
    
    return sanitized;
  }
}

export const azureGDPRService = AzureGDPRService.getInstance();
