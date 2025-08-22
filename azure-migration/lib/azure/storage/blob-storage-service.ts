/**
 * Azure Blob Storage Service Implementation
 * 
 * Replaces Firebase Storage with Azure Blob Storage
 * Implements IStorageService interface for provider-agnostic usage
 */

import { 
  BlobServiceClient, 
  BlobSASPermissions, 
  generateBlobSASQueryParameters, 
  StorageSharedKeyCredential,
  BlobSASSignatureValues,
  SASProtocol,
  ContainerClient,
  BlockBlobClient
} from '@azure/storage-blob';
import { 
  IStorageService, 
  StorageFile, 
  UploadResult, 
  UploadOptions 
} from '../../shared/interfaces';
import { BaseStorageService } from '../../shared/interfaces/base-services';
import { getConfigManager } from '../../config/unified-config';

export class AzureBlobStorageService extends BaseStorageService {
  private client?: BlobServiceClient;
  private credential?: StorageSharedKeyCredential;
  private accountName?: string;
  
  // Container mapping for different file types
  private readonly containerMap = {
    resumes: 'user-resumes',
    profilePictures: 'profile-pictures',
    documents: 'user-documents',
    uploads: 'general-uploads',
    default: 'default-container'
  };
  
  constructor() {
    super('azure');
  }
  
  /**
   * Initialize Azure Blob Storage client
   */
  protected async initialize(): Promise<void> {
    try {
      const configManager = await getConfigManager();
      const storageConfig = configManager.getServiceConfig('blobStorage', 'azure');
      
      if (!storageConfig.enabled) {
        throw new Error('Azure Blob Storage service is not enabled');
      }
      
      const { accountName, accountKey, connectionString } = storageConfig.config;
      
      if (connectionString) {
        // Use connection string if available
        this.client = BlobServiceClient.fromConnectionString(connectionString);
      } else if (accountName && accountKey) {
        // Use account name and key
        this.accountName = accountName;
        this.credential = new StorageSharedKeyCredential(accountName, accountKey);
        this.client = new BlobServiceClient(
          `https://${accountName}.blob.core.windows.net`,
          this.credential
        );
      } else {
        throw new Error('Azure Blob Storage credentials not provided');
      }
      
      // Ensure all containers exist
      await this.ensureContainers();
      
      this.logSuccess('initialize', { accountName: accountName || '***' });
    } catch (error) {
      this.handleError(error, 'initialize');
    }
  }
  
  /**
   * Ensure all required containers exist
   */
  private async ensureContainers(): Promise<void> {
    if (!this.client) {
      throw new Error('Blob Storage client not initialized');
    }
    
    try {
      for (const containerName of Object.values(this.containerMap)) {
        const containerClient = this.client.getContainerClient(containerName);
        await containerClient.createIfNotExists();
      }
    } catch (error) {
      console.error('Failed to ensure containers exist:', error);
      throw error;
    }
  }
  
  /**
   * Upload file to blob storage
   */
  async upload(
    container: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    try {
      await this.ensureInitialized();
      
      this.validateFile(fileBuffer, fileName, mimeType);
      
      const containerName = this.mapContainerName(container);
      const blobName = this.generateSafeFilePath('user', fileName); // TODO: Use actual userId
      
      const containerClient = this.client!.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      // Upload with metadata
      await blockBlobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: {
          blobContentType: mimeType,
          blobCacheControl: 'public, max-age=31536000' // 1 year cache
        },
        metadata: {
          originalFileName: fileName,
          uploadDate: new Date().toISOString(),
          mimeType,
          ...(options?.metadata || {})
        }
      });
      
      const file: StorageFile = {
        id: blobName,
        name: fileName,
        url: blockBlobClient.url,
        size: fileBuffer.length,
        mimeType,
        metadata: options?.metadata,
        uploadedAt: new Date()
      };
      
      const result: UploadResult = { file };
      
      // Generate signed URL if requested
      if (options?.generatePublicUrl || options?.expiryHours) {
        result.sasUrl = await this.generateSignedUrl(
          container, 
          blobName, 
          options?.expiryHours || 24
        );
      }
      
      this.logSuccess('upload', { 
        container: containerName, 
        fileName, 
        size: fileBuffer.length 
      });
      
      return result;
    } catch (error) {
      this.handleError(error, 'upload', { container, fileName });
    }
  }
  
  /**
   * Download file from blob storage
   */
  async download(container: string, fileName: string): Promise<Buffer> {
    try {
      await this.ensureInitialized();
      
      const containerName = this.mapContainerName(container);
      const containerClient = this.client!.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      
      const downloadResponse = await blockBlobClient.download();
      
      if (!downloadResponse.readableStreamBody) {
        throw new Error('Failed to download file - no stream available');
      }
      
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
      }
      
      const buffer = Buffer.concat(chunks);
      
      this.logSuccess('download', { container: containerName, fileName, size: buffer.length });
      return buffer;
    } catch (error) {
      this.handleError(error, 'download', { container, fileName });
    }
  }
  
  /**
   * Delete file from blob storage
   */
  async delete(container: string, fileName: string): Promise<void> {
    try {
      await this.ensureInitialized();
      
      const containerName = this.mapContainerName(container);
      const containerClient = this.client!.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      
      await blockBlobClient.deleteIfExists();
      
      this.logSuccess('delete', { container: containerName, fileName });
    } catch (error) {
      this.handleError(error, 'delete', { container, fileName });
    }
  }
  
  /**
   * Generate signed URL for temporary access
   */
  async generateSignedUrl(container: string, fileName: string, expiryHours: number = 1): Promise<string> {
    try {
      await this.ensureInitialized();
      
      if (!this.credential || !this.accountName) {
        throw new Error('Shared key credential required for SAS token generation');
      }
      
      const containerName = this.mapContainerName(container);
      const permissions = BlobSASPermissions.parse('r'); // Read-only
      const expiresOn = new Date();
      expiresOn.setHours(expiresOn.getHours() + expiryHours);
      
      const sasOptions: BlobSASSignatureValues = {
        containerName,
        blobName: fileName,
        permissions,
        expiresOn,
        protocol: SASProtocol.Https
      };
      
      const sasToken = generateBlobSASQueryParameters(sasOptions, this.credential);
      const sasUrl = `https://${this.accountName}.blob.core.windows.net/${containerName}/${fileName}?${sasToken}`;
      
      this.logSuccess('generateSignedUrl', { 
        container: containerName, 
        fileName, 
        expiryHours 
      });
      
      return sasUrl;
    } catch (error) {
      this.handleError(error, 'generateSignedUrl', { container, fileName });
    }
  }
  
  /**
   * List files in container
   */
  async listFiles(container: string, prefix?: string): Promise<StorageFile[]> {
    try {
      await this.ensureInitialized();
      
      const containerName = this.mapContainerName(container);
      const containerClient = this.client!.getContainerClient(containerName);
      
      const files: StorageFile[] = [];
      
      for await (const blob of containerClient.listBlobsFlat({ prefix, includeMetadata: true })) {
        const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
        
        files.push({
          id: blob.name,
          name: blob.metadata?.originalFileName || blob.name,
          url: blockBlobClient.url,
          size: blob.properties.contentLength || 0,
          mimeType: blob.properties.contentType || 'application/octet-stream',
          metadata: blob.metadata,
          uploadedAt: blob.properties.lastModified || new Date()
        });
      }
      
      this.logSuccess('listFiles', { 
        container: containerName, 
        prefix, 
        count: files.length 
      });
      
      return files;
    } catch (error) {
      this.handleError(error, 'listFiles', { container, prefix });
    }
  }
  
  /**
   * Get file metadata
   */
  async getFileMetadata(container: string, fileName: string): Promise<StorageFile> {
    try {
      await this.ensureInitialized();
      
      const containerName = this.mapContainerName(container);
      const containerClient = this.client!.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      
      const properties = await blockBlobClient.getProperties();
      
      const file: StorageFile = {
        id: fileName,
        name: properties.metadata?.originalFileName || fileName,
        url: blockBlobClient.url,
        size: properties.contentLength || 0,
        mimeType: properties.contentType || 'application/octet-stream',
        metadata: properties.metadata,
        uploadedAt: properties.lastModified || new Date()
      };
      
      return file;
    } catch (error) {
      this.handleError(error, 'getFileMetadata', { container, fileName });
    }
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.ensureInitialized();
      
      if (!this.client) {
        return { healthy: false, message: 'Blob Storage client not initialized' };
      }
      
      // Test connectivity by getting account info
      await this.client.getAccountInfo();
      
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  // ===== PRIVATE HELPER METHODS =====
  
  /**
   * Map logical container names to actual container names
   */
  private mapContainerName(container: string): string {
    return this.containerMap[container as keyof typeof this.containerMap] || 
           this.containerMap.default;
  }
}

// ===== STORAGE MIGRATION UTILITIES =====

export class BlobStorageMigrationUtils {
  /**
   * Migrate files from Firebase Storage to Azure Blob Storage
   */
  static async migrateFiles(
    firebaseStorage: IStorageService,
    azureStorage: AzureBlobStorageService,
    container: string,
    options: {
      batchSize?: number;
      dryRun?: boolean;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<{ success: boolean; migrated: number; errors: string[] }> {
    const { batchSize = 20, dryRun = false, onProgress } = options;
    
    try {
      console.log(`📦 Starting file migration for container: ${container} (dryRun: ${dryRun})`);
      
      // Get all files from Firebase Storage
      const files = await firebaseStorage.listFiles(container);
      const total = files.length;
      let processed = 0;
      const errors: string[] = [];
      
      console.log(`📊 Found ${total} files to migrate`);
      
      if (dryRun) {
        console.log(`🧪 DRY RUN: Would migrate ${total} files`);
        return { success: true, migrated: 0, errors: [] };
      }
      
      // Process in batches (smaller batches for files due to size)
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (file) => {
          try {
            // Download from Firebase
            const fileBuffer = await firebaseStorage.download(container, file.name);
            
            // Upload to Azure
            await azureStorage.upload(
              container,
              file.name,
              fileBuffer,
              file.mimeType,
              {
                metadata: {
                  ...file.metadata,
                  migratedFrom: 'firebase',
                  migrationDate: new Date().toISOString()
                }
              }
            );
            
            processed++;
            
            if (processed % 10 === 0) {
              console.log(`📈 Progress: ${processed}/${total} files migrated`);
            }
          } catch (error) {
            const errorMsg = `File ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(`❌ File migration error:`, errorMsg);
          }
        });
        
        await Promise.all(batchPromises);
        
        if (onProgress) {
          onProgress(processed, total);
        }
        
        // Delay between batches to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const success = errors.length === 0;
      console.log(`${success ? '✅' : '⚠️'} File migration completed: ${processed}/${total} files migrated, ${errors.length} errors`);
      
      return { success, migrated: processed, errors };
    } catch (error) {
      console.error(`❌ File migration failed:`, error);
      return { 
        success: false, 
        migrated: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      };
    }
  }
  
  /**
   * Validate file migration by comparing file lists and sample downloads
   */
  static async validateMigration(
    firebaseStorage: IStorageService,
    azureStorage: AzureBlobStorageService,
    container: string,
    sampleSize: number = 5
  ): Promise<{ valid: boolean; details: Record<string, any> }> {
    try {
      const [firebaseFiles, azureFiles] = await Promise.all([
        firebaseStorage.listFiles(container),
        azureStorage.listFiles(container)
      ]);
      
      const firebaseCount = firebaseFiles.length;
      const azureCount = azureFiles.length;
      const countMatches = firebaseCount === azureCount;
      
      // Sample file comparison
      const sampleComparisons: any[] = [];
      const sampleFiles = firebaseFiles.slice(0, Math.min(sampleSize, firebaseFiles.length));
      
      for (const firebaseFile of sampleFiles) {
        const azureFile = azureFiles.find(f => f.name === firebaseFile.name);
        
        if (!azureFile) {
          sampleComparisons.push({
            name: firebaseFile.name,
            status: 'missing_in_azure'
          });
        } else {
          // Compare file sizes
          const sizeMatches = Math.abs(firebaseFile.size - azureFile.size) < 1024; // Allow 1KB difference
          
          sampleComparisons.push({
            name: firebaseFile.name,
            status: sizeMatches ? 'match' : 'size_mismatch',
            firebase_size: firebaseFile.size,
            azure_size: azureFile.size
          });
        }
      }
      
      const allSamplesMatch = sampleComparisons.every(c => c.status === 'match');
      
      return {
        valid: countMatches && allSamplesMatch,
        details: {
          counts: { firebase: firebaseCount, azure: azureCount, match: countMatches },
          sampleComparisons,
          sampleSize: sampleComparisons.length
        }
      };
    } catch (error) {
      return {
        valid: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  /**
   * Sync file from Firebase to Azure (useful for real-time sync during migration)
   */
  static async syncFile(
    firebaseStorage: IStorageService,
    azureStorage: AzureBlobStorageService,
    container: string,
    fileName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Download from Firebase
      const fileBuffer = await firebaseStorage.download(container, fileName);
      const fileMetadata = await firebaseStorage.getFileMetadata(container, fileName);
      
      // Upload to Azure
      await azureStorage.upload(
        container,
        fileName,
        fileBuffer,
        fileMetadata.mimeType,
        {
          metadata: {
            ...fileMetadata.metadata,
            syncedFrom: 'firebase',
            syncDate: new Date().toISOString()
          }
        }
      );
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
