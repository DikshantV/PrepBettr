import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential, BlobSASSignatureValues, SASProtocol } from '@azure/storage-blob';
import { fetchAzureSecrets } from '@/azure/lib/azure-config';
import { logServerError } from '@/lib/errors';

interface AzureBlobConfig {
  accountName: string;
  accountKey: string;
  containerName: string;
}

interface UploadResult {
  blobUrl: string;
  blobName: string;
  sasUrl?: string;
}

interface SASTokenResult {
  sasUrl: string;
  expiresOn: Date;
}

class AzureBlobStorageService {
  private blobServiceClient: BlobServiceClient | null = null;
  private config: AzureBlobConfig | null = null;
  private containerName = 'user-resumes';

  /**
   * Initialize the Azure Blob Storage service
   */
  async initialize(): Promise<boolean> {
    try {
      // Get Azure configuration from Key Vault or environment
      const secrets = await fetchAzureSecrets();
      
      this.config = {
        accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || secrets.azureStorageAccountName || '',
        accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || secrets.azureStorageAccountKey || '',
        containerName: this.containerName
      };

      if (!this.config.accountName || !this.config.accountKey) {
        console.warn('⚠️ Azure Blob Storage credentials not found, falling back to Firebase');
        return false;
      }

      // Create blob service client
      const sharedKeyCredential = new StorageSharedKeyCredential(
        this.config.accountName, 
        this.config.accountKey
      );

      this.blobServiceClient = new BlobServiceClient(
        `https://${this.config.accountName}.blob.core.windows.net`,
        sharedKeyCredential
      );

      // Ensure container exists
      await this.ensureContainer();

      console.log('✅ Azure Blob Storage service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Azure Blob Storage:', error);
      logServerError(error as Error, { service: 'azure-blob-storage', action: 'initialize' });
      return false;
    }
  }

  /**
   * Ensure the container exists
   */
  private async ensureContainer(): Promise<void> {
    if (!this.blobServiceClient || !this.config) {
      throw new Error('Azure Blob Storage service not initialized');
    }

    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.createIfNotExists({
        access: 'container' // Allow container-level access
      });
    } catch (error) {
      console.error('Failed to ensure container exists:', error);
      throw error;
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.blobServiceClient !== null && this.config !== null;
  }

  /**
   * Upload resume file to Azure Blob Storage
   */
  async uploadResume(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<UploadResult> {
    if (!this.isReady()) {
      throw new Error('Azure Blob Storage service not initialized');
    }

    try {
      const blobName = `${userId}/${Date.now()}-${fileName}`;
      const containerClient = this.blobServiceClient!.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Upload the file with metadata
      await blockBlobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: {
          blobContentType: mimeType
        },
        metadata: {
          userId,
          originalFileName: fileName,
          uploadDate: new Date().toISOString(),
          mimeType
        }
      });

      const blobUrl = blockBlobClient.url;
      
      // Generate SAS URL for temporary access
      const sasUrl = await this.generateSASUrl(blobName, 24); // 24 hours access

      console.log(`✅ Resume uploaded to Azure Blob Storage: ${blobName}`);
      
      return {
        blobUrl,
        blobName,
        sasUrl: sasUrl.sasUrl
      };
    } catch (error) {
      console.error('Failed to upload resume to Azure Blob Storage:', error);
      logServerError(error as Error, { 
        service: 'azure-blob-storage', 
        action: 'upload', 
        userId
      }, {
        fileName: fileName.substring(0, 50) // Truncate for privacy
      });
      throw error;
    }
  }

  /**
   * Generate SAS URL for temporary access to blob
   */
  async generateSASUrl(blobName: string, expiryHours: number = 1): Promise<SASTokenResult> {
    if (!this.isReady() || !this.config) {
      throw new Error('Azure Blob Storage service not initialized');
    }

    try {
      const permissions = BlobSASPermissions.parse('r'); // Read-only permission
      const expiresOn = new Date();
      expiresOn.setHours(expiresOn.getHours() + expiryHours);

      const sharedKeyCredential = new StorageSharedKeyCredential(
        this.config.accountName,
        this.config.accountKey
      );

      const sasOptions: BlobSASSignatureValues = {
        containerName: this.containerName,
        blobName,
        permissions,
        expiresOn,
        protocol: SASProtocol.Https
      };

      const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential);
      const sasUrl = `https://${this.config.accountName}.blob.core.windows.net/${this.containerName}/${blobName}?${sasToken}`;

      return {
        sasUrl,
        expiresOn
      };
    } catch (error) {
      console.error('Failed to generate SAS URL:', error);
      logServerError(error as Error, { 
        service: 'azure-blob-storage', 
        action: 'generate-sas'
      }, {
        blobName: blobName.substring(0, 50) 
      });
      throw error;
    }
  }

  /**
   * Delete resume from Azure Blob Storage
   */
  async deleteResume(blobName: string): Promise<void> {
    if (!this.isReady()) {
      console.warn('Azure Blob Storage service not initialized, skipping delete');
      return;
    }

    try {
      const containerClient = this.blobServiceClient!.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.deleteIfExists();
      console.log(`✅ Resume deleted from Azure Blob Storage: ${blobName}`);
    } catch (error) {
      console.error('Failed to delete resume from Azure Blob Storage:', error);
      logServerError(error as Error, { 
        service: 'azure-blob-storage', 
        action: 'delete'
      }, {
        blobName: blobName.substring(0, 50) 
      });
      // Don't throw - we don't want to block the operation if deletion fails
    }
  }

  /**
   * Get blob info
   */
  async getBlobInfo(blobName: string): Promise<any> {
    if (!this.isReady()) {
      throw new Error('Azure Blob Storage service not initialized');
    }

    try {
      const containerClient = this.blobServiceClient!.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      const properties = await blockBlobClient.getProperties();
      return {
        blobName,
        contentLength: properties.contentLength,
        contentType: properties.contentType,
        lastModified: properties.lastModified,
        metadata: properties.metadata
      };
    } catch (error) {
      console.error('Failed to get blob info:', error);
      throw error;
    }
  }

  /**
   * List blobs for a user
   */
  async listUserBlobs(userId: string): Promise<string[]> {
    if (!this.isReady()) {
      throw new Error('Azure Blob Storage service not initialized');
    }

    try {
      const containerClient = this.blobServiceClient!.getContainerClient(this.containerName);
      const blobNames: string[] = [];
      
      for await (const blob of containerClient.listBlobsFlat({ prefix: `${userId}/` })) {
        blobNames.push(blob.name);
      }

      return blobNames;
    } catch (error) {
      console.error('Failed to list user blobs:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const azureBlobStorage = new AzureBlobStorageService();
