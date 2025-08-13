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
  
  // Container configurations
  private readonly containers = {
    resumes: 'user-resumes',
    profilePictures: 'profile-pictures', 
    documents: 'user-documents'
  };

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
        containerName: 'legacy' // Keeping for compatibility, but we use containers object now
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
   * Ensure all containers exist
   */
  private async ensureContainer(): Promise<void> {
    if (!this.blobServiceClient || !this.config) {
      throw new Error('Azure Blob Storage service not initialized');
    }

    try {
      // Ensure all containers exist
      for (const containerName of Object.values(this.containers)) {
        const containerClient = this.blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists({
          access: 'container' // Allow container-level access
        });
      }
    } catch (error) {
      console.error('Failed to ensure containers exist:', error);
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
      const containerName = this.containers.resumes;
      const containerClient = this.blobServiceClient!.getContainerClient(containerName);
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
      const sasUrl = await this.generateSASUrlForContainer(containerName, blobName, 24);

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

      // This method is deprecated - use generateSASUrlForContainer instead
      const containerName = this.containers.resumes; // Default to resumes container
      const sasOptions: BlobSASSignatureValues = {
        containerName,
        blobName,
        permissions,
        expiresOn,
        protocol: SASProtocol.Https
      };

      const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential);
      const sasUrl = `https://${this.config.accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;

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
      const containerName = this.containers.resumes;
      const containerClient = this.blobServiceClient!.getContainerClient(containerName);
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
      const containerName = this.containers.resumes; // Default to resumes container
      const containerClient = this.blobServiceClient!.getContainerClient(containerName);
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
   * Upload profile picture to Azure Blob Storage
   */
  async uploadProfilePicture(
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
      const containerClient = this.blobServiceClient!.getContainerClient(this.containers.profilePictures);
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
          mimeType,
          fileType: 'profile-picture'
        }
      });

      const blobUrl = blockBlobClient.url;
      
      // Generate public URL (no SAS needed for profile pictures)
      const publicUrl = `https://${this.config!.accountName}.blob.core.windows.net/${this.containers.profilePictures}/${blobName}`;

      console.log(`✅ Profile picture uploaded to Azure Blob Storage: ${blobName}`);
      
      return {
        blobUrl: publicUrl,
        blobName,
      };
    } catch (error) {
      console.error('Failed to upload profile picture to Azure Blob Storage:', error);
      logServerError(error as Error, { 
        service: 'azure-blob-storage', 
        action: 'upload-profile', 
        userId
      }, {
        fileName: fileName.substring(0, 50)
      });
      throw error;
    }
  }

  /**
   * Upload general file to Azure Blob Storage
   */
  async uploadFile(
    containerType: keyof typeof this.containers,
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    metadata: Record<string, string> = {}
  ): Promise<UploadResult> {
    if (!this.isReady()) {
      throw new Error('Azure Blob Storage service not initialized');
    }

    try {
      const blobName = `${userId}/${Date.now()}-${fileName}`;
      const containerName = this.containers[containerType];
      const containerClient = this.blobServiceClient!.getContainerClient(containerName);
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
          mimeType,
          containerType,
          ...metadata
        }
      });

      const blobUrl = blockBlobClient.url;
      
      // Generate SAS URL for secure access
      const sasResult = await this.generateSASUrlForContainer(containerName, blobName, 24);

      console.log(`✅ File uploaded to Azure Blob Storage: ${blobName} in container ${containerName}`);
      
      return {
        blobUrl,
        blobName,
        sasUrl: sasResult.sasUrl
      };
    } catch (error) {
      console.error(`Failed to upload file to Azure Blob Storage container ${containerType}:`, error);
      logServerError(error as Error, { 
        service: 'azure-blob-storage', 
        action: 'upload-file', 
        userId
      }, {
        fileName: fileName.substring(0, 50),
        containerType
      });
      throw error;
    }
  }

  /**
   * Generate SAS URL for specific container and blob
   */
  private async generateSASUrlForContainer(
    containerName: string,
    blobName: string, 
    expiryHours: number = 1
  ): Promise<SASTokenResult> {
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
        containerName,
        blobName,
        permissions,
        expiresOn,
        protocol: SASProtocol.Https
      };

      const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential);
      const sasUrl = `https://${this.config.accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;

      return {
        sasUrl,
        expiresOn
      };
    } catch (error) {
      console.error('Failed to generate SAS URL for container:', error);
      throw error;
    }
  }

  /**
   * Delete file from specific container
   */
  async deleteFile(containerType: keyof typeof this.containers, blobName: string): Promise<void> {
    if (!this.isReady()) {
      console.warn('Azure Blob Storage service not initialized, skipping delete');
      return;
    }

    try {
      const containerName = this.containers[containerType];
      const containerClient = this.blobServiceClient!.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.deleteIfExists();
      console.log(`✅ File deleted from Azure Blob Storage: ${blobName} in container ${containerName}`);
    } catch (error) {
      console.error(`Failed to delete file from Azure Blob Storage container ${containerType}:`, error);
      logServerError(error as Error, { 
        service: 'azure-blob-storage', 
        action: 'delete-file'
      }, {
        blobName: blobName.substring(0, 50),
        containerType
      });
      // Don't throw - we don't want to block the operation if deletion fails
    }
  }

  /**
   * Delete all files for a user (GDPR compliance)
   */
  async deleteAllUserFiles(userId: string): Promise<string[]> {
    if (!this.isReady()) {
      console.warn('Azure Blob Storage service not initialized, skipping delete');
      return [];
    }

    const deletedContainers: string[] = [];

    try {
      // Delete from all containers
      for (const [containerType, containerName] of Object.entries(this.containers)) {
        try {
          const containerClient = this.blobServiceClient!.getContainerClient(containerName);
          const blobsToDelete: string[] = [];
          
          // List all blobs for this user in this container
          for await (const blob of containerClient.listBlobsFlat({ prefix: `${userId}/` })) {
            blobsToDelete.push(blob.name);
          }

          // Delete all user blobs in this container
          if (blobsToDelete.length > 0) {
            const deletePromises = blobsToDelete.map(async (blobName) => {
              const blockBlobClient = containerClient.getBlockBlobClient(blobName);
              await blockBlobClient.deleteIfExists();
            });
            
            await Promise.all(deletePromises);
            deletedContainers.push(containerType);
            console.log(`✅ Deleted ${blobsToDelete.length} files for user ${userId} from container ${containerName}`);
          }
        } catch (error) {
          console.error(`Failed to delete files from container ${containerName}:`, error);
        }
      }

      return deletedContainers;
    } catch (error) {
      console.error('Failed to delete all user files from Azure Blob Storage:', error);
      logServerError(error as Error, { 
        service: 'azure-blob-storage', 
        action: 'delete-all-user-files',
        userId
      });
      return deletedContainers;
    }
  }

  /**
   * List blobs for a user in specific container
   */
  async listUserBlobs(
    containerType: keyof typeof this.containers, 
    userId: string
  ): Promise<string[]> {
    if (!this.isReady()) {
      throw new Error('Azure Blob Storage service not initialized');
    }

    try {
      const containerName = this.containers[containerType];
      const containerClient = this.blobServiceClient!.getContainerClient(containerName);
      const blobNames: string[] = [];
      
      for await (const blob of containerClient.listBlobsFlat({ prefix: `${userId}/` })) {
        blobNames.push(blob.name);
      }

      return blobNames;
    } catch (error) {
      console.error(`Failed to list user blobs in container ${containerType}:`, error);
      throw error;
    }
  }

  /**
   * List all blobs for a user across all containers
   */
  async listAllUserBlobs(userId: string): Promise<Record<string, string[]>> {
    if (!this.isReady()) {
      throw new Error('Azure Blob Storage service not initialized');
    }

    const result: Record<string, string[]> = {};

    try {
      for (const [containerType, containerName] of Object.entries(this.containers)) {
        try {
          const blobs = await this.listUserBlobs(containerType as keyof typeof this.containers, userId);
          result[containerType] = blobs;
        } catch (error) {
          console.error(`Failed to list blobs in container ${containerType}:`, error);
          result[containerType] = [];
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to list all user blobs:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const azureBlobStorage = new AzureBlobStorageService();
