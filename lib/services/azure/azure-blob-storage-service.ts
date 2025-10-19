// Azure Blob Storage Service
// Handles file upload, download, and management operations for PrepBettr

import { 
  BlobServiceClient, 
  ContainerClient, 
  BlobClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  BlobUploadCommonResponse,
  BlobDownloadResponseParsed,
  ContainerListBlobsOptions
} from '@azure/storage-blob';
import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity';
import { IFileStorageService, FileMetadata, UploadResult, FileListResult } from '../interfaces/IFileStorageService';

export interface AzureBlobStorageConfig {
  accountName?: string;
  connectionString?: string;
  accountKey?: string;
  containerNames: {
    userResumes: string;
    userDocuments: string;
    processedFiles: string;
    mediaUploads: string;
  };
  useManagedIdentity?: boolean;
  enableSAS?: boolean;
  sasExpiryMinutes?: number;
}

export interface BlobMetadata extends FileMetadata {
  blobName: string;
  containerName: string;
  etag?: string;
  lastModified?: Date;
  blobType?: string;
  accessTier?: string;
  serverEncrypted?: boolean;
}

export class AzureBlobStorageService implements IFileStorageService {
  private blobServiceClient: BlobServiceClient;
  private config: AzureBlobStorageConfig;
  private containerClients: Map<string, ContainerClient> = new Map();

  constructor(config: AzureBlobStorageConfig) {
    this.config = {
      enableSAS: false,
      sasExpiryMinutes: 60,
      useManagedIdentity: false,
      ...config
    };

    this.initializeBlobServiceClient();
  }

  private initializeBlobServiceClient(): void {
    try {
      if (this.config.connectionString) {
        // Use connection string (development/local)
        this.blobServiceClient = BlobServiceClient.fromConnectionString(
          this.config.connectionString
        );
      } else if (this.config.useManagedIdentity) {
        // Use managed identity (production)
        const credential = new ManagedIdentityCredential();
        this.blobServiceClient = new BlobServiceClient(
          `https://${this.config.accountName}.blob.core.windows.net`,
          credential
        );
      } else if (this.config.accountName && this.config.accountKey) {
        // Use account key
        const credential = new StorageSharedKeyCredential(
          this.config.accountName,
          this.config.accountKey
        );
        this.blobServiceClient = new BlobServiceClient(
          `https://${this.config.accountName}.blob.core.windows.net`,
          credential
        );
      } else {
        // Use default Azure credential
        const credential = new DefaultAzureCredential();
        this.blobServiceClient = new BlobServiceClient(
          `https://${this.config.accountName}.blob.core.windows.net`,
          credential
        );
      }

      console.log('✅ Azure Blob Storage client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Azure Blob Storage client:', error);
      throw new Error(`Azure Blob Storage initialization failed: ${error.message}`);
    }
  }

  private getContainerClient(containerName: string): ContainerClient {
    if (!this.containerClients.has(containerName)) {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      this.containerClients.set(containerName, containerClient);
    }
    return this.containerClients.get(containerName)!;
  }

  private generateBlobPath(userId: string, fileName: string, category: 'resume' | 'document' | 'processed' | 'media'): string {
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    switch (category) {
      case 'resume':
        return `${userId}/resumes/${timestamp}/${sanitizedFileName}`;
      case 'document':
        return `${userId}/documents/${timestamp}/${sanitizedFileName}`;
      case 'processed':
        return `${userId}/processed/${timestamp}/${sanitizedFileName}`;
      case 'media':
        return `${userId}/media/${timestamp}/${sanitizedFileName}`;
      default:
        return `${userId}/misc/${timestamp}/${sanitizedFileName}`;
    }
  }

  async uploadFile(
    file: Buffer | Uint8Array | string,
    fileName: string,
    userId: string,
    category: 'resume' | 'document' | 'processed' | 'media' = 'document',
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    try {
      const containerName = this.getContainerNameForCategory(category);
      const containerClient = this.getContainerClient(containerName);
      
      // Ensure container exists
      await this.ensureContainerExists(containerClient);
      
      const blobPath = this.generateBlobPath(userId, fileName, category);
      const blobClient = containerClient.getBlobClient(blobPath);
      const blockBlobClient = blobClient.getBlockBlobClient();

      // Prepare upload options
      const uploadOptions = {
        metadata: {
          userId,
          originalFileName: fileName,
          category,
          uploadedAt: new Date().toISOString(),
          ...metadata
        },
        tags: {
          userId,
          category,
          environment: process.env.NODE_ENV || 'development'
        }
      };

      // Upload file
      let uploadResponse: BlobUploadCommonResponse;
      if (typeof file === 'string') {
        uploadResponse = await blockBlobClient.upload(file, Buffer.byteLength(file), uploadOptions);
      } else {
        uploadResponse = await blockBlobClient.upload(file, file.length, uploadOptions);
      }

      // Generate SAS URL if enabled
      let downloadUrl: string | undefined;
      let publicUrl: string | undefined;
      
      if (this.config.enableSAS) {
        downloadUrl = await this.generateSASUrl(blobClient, 'r', this.config.sasExpiryMinutes);
      }
      
      publicUrl = blobClient.url;

      const result: UploadResult = {
        success: true,
        fileId: blobPath,
        fileName,
        filePath: blobPath,
        fileSize: typeof file === 'string' ? Buffer.byteLength(file) : file.length,
        contentType: this.getMimeType(fileName),
        uploadedAt: new Date(),
        downloadUrl,
        publicUrl,
        metadata: {
          etag: uploadResponse.etag,
          requestId: uploadResponse.requestId,
          containerName,
          blobName: blobPath
        }
      };

      console.log(`✅ File uploaded successfully: ${blobPath}`);
      return result;

    } catch (error) {
      console.error('❌ File upload failed:', error);
      return {
        success: false,
        error: error.message,
        fileName
      };
    }
  }

  async downloadFile(fileId: string, userId: string): Promise<Buffer | null> {
    try {
      // Extract container name from fileId path
      const containerName = this.extractContainerFromPath(fileId);
      const containerClient = this.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(fileId);

      // Check if user has access to this file
      if (!await this.validateFileAccess(blobClient, userId)) {
        throw new Error('Access denied: User does not have permission to access this file');
      }

      const downloadResponse: BlobDownloadResponseParsed = await blobClient.download();
      
      if (!downloadResponse.readableStreamBody) {
        return null;
      }

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        downloadResponse.readableStreamBody!.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        downloadResponse.readableStreamBody!.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        
        downloadResponse.readableStreamBody!.on('error', reject);
      });

    } catch (error) {
      console.error('❌ File download failed:', error);
      return null;
    }
  }

  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      const containerName = this.extractContainerFromPath(fileId);
      const containerClient = this.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(fileId);

      // Validate user access
      if (!await this.validateFileAccess(blobClient, userId)) {
        throw new Error('Access denied: User does not have permission to delete this file');
      }

      const deleteResponse = await blobClient.delete({
        deleteSnapshots: 'include'
      });

      console.log(`✅ File deleted successfully: ${fileId}`);
      return true;

    } catch (error) {
      console.error('❌ File deletion failed:', error);
      return false;
    }
  }

  async getFileMetadata(fileId: string, userId: string): Promise<BlobMetadata | null> {
    try {
      const containerName = this.extractContainerFromPath(fileId);
      const containerClient = this.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(fileId);

      // Validate user access
      if (!await this.validateFileAccess(blobClient, userId)) {
        return null;
      }

      const properties = await blobClient.getProperties();

      const metadata: BlobMetadata = {
        fileId,
        fileName: properties.metadata?.originalFileName || fileId.split('/').pop() || 'unknown',
        filePath: fileId,
        fileSize: properties.contentLength || 0,
        contentType: properties.contentType || 'application/octet-stream',
        uploadedAt: properties.createdOn || new Date(),
        lastModified: properties.lastModified,
        blobName: fileId,
        containerName,
        etag: properties.etag,
        blobType: properties.blobType,
        accessTier: properties.accessTier,
        serverEncrypted: properties.isServerEncrypted,
        customMetadata: properties.metadata || {}
      };

      return metadata;

    } catch (error) {
      console.error('❌ Failed to get file metadata:', error);
      return null;
    }
  }

  async listUserFiles(userId: string, category?: string): Promise<FileListResult> {
    try {
      const files: BlobMetadata[] = [];
      const containers = category 
        ? [this.getContainerNameForCategory(category as any)]
        : Object.values(this.config.containerNames);

      for (const containerName of containers) {
        const containerClient = this.getContainerClient(containerName);
        
        const listOptions: ContainerListBlobsOptions = {
          prefix: `${userId}/`,
          includeMetadata: true,
          includeTags: true
        };

        try {
          for await (const blob of containerClient.listBlobsFlat(listOptions)) {
            const metadata: BlobMetadata = {
              fileId: blob.name,
              fileName: blob.metadata?.originalFileName || blob.name.split('/').pop() || 'unknown',
              filePath: blob.name,
              fileSize: blob.properties.contentLength || 0,
              contentType: blob.properties.contentType || 'application/octet-stream',
              uploadedAt: blob.properties.createdOn || new Date(),
              lastModified: blob.properties.lastModified,
              blobName: blob.name,
              containerName,
              etag: blob.properties.etag,
              blobType: blob.properties.blobType,
              accessTier: blob.properties.accessTier,
              serverEncrypted: blob.properties.serverEncrypted,
              customMetadata: blob.metadata || {}
            };

            files.push(metadata);
          }
        } catch (containerError) {
          // Log error but continue with other containers
          console.warn(`⚠️ Failed to list files in container ${containerName}:`, containerError.message);
        }
      }

      return {
        success: true,
        files,
        totalCount: files.length
      };

    } catch (error) {
      console.error('❌ Failed to list user files:', error);
      return {
        success: false,
        files: [],
        totalCount: 0,
        error: error.message
      };
    }
  }

  async generateSASUrl(
    blobClient: BlobClient, 
    permissions: string = 'r', 
    expiryMinutes: number = 60
  ): Promise<string> {
    if (!this.config.accountKey) {
      throw new Error('Account key required for SAS token generation');
    }

    const sasPermissions = new BlobSASPermissions();
    if (permissions.includes('r')) sasPermissions.read = true;
    if (permissions.includes('w')) sasPermissions.write = true;
    if (permissions.includes('d')) sasPermissions.delete = true;

    const sasOptions = {
      containerName: blobClient.containerName,
      blobName: blobClient.name,
      permissions: sasPermissions,
      expiresOn: new Date(Date.now() + expiryMinutes * 60 * 1000),
    };

    const credential = new StorageSharedKeyCredential(
      this.config.accountName!,
      this.config.accountKey
    );

    const sasToken = generateBlobSASQueryParameters(sasOptions, credential).toString();
    return `${blobClient.url}?${sasToken}`;
  }

  // Health check method
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Test connection by listing containers
      const containerIterator = this.blobServiceClient.listContainers();
      const firstContainer = await containerIterator.next();
      
      return {
        healthy: true,
        message: 'Azure Blob Storage connection healthy'
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Azure Blob Storage health check failed: ${error.message}`
      };
    }
  }

  // Private helper methods

  private getContainerNameForCategory(category: 'resume' | 'document' | 'processed' | 'media'): string {
    switch (category) {
      case 'resume':
        return this.config.containerNames.userResumes;
      case 'document':
        return this.config.containerNames.userDocuments;
      case 'processed':
        return this.config.containerNames.processedFiles;
      case 'media':
        return this.config.containerNames.mediaUploads;
      default:
        return this.config.containerNames.userDocuments;
    }
  }

  private extractContainerFromPath(filePath: string): string {
    // Try to determine container from file path patterns
    if (filePath.includes('/resumes/')) return this.config.containerNames.userResumes;
    if (filePath.includes('/processed/')) return this.config.containerNames.processedFiles;
    if (filePath.includes('/media/')) return this.config.containerNames.mediaUploads;
    return this.config.containerNames.userDocuments;
  }

  private async ensureContainerExists(containerClient: ContainerClient): Promise<void> {
    try {
      await containerClient.createIfNotExists({
        access: 'private'
      });
    } catch (error) {
      console.warn(`⚠️ Could not create container ${containerClient.containerName}:`, error.message);
    }
  }

  private async validateFileAccess(blobClient: BlobClient, userId: string): Promise<boolean> {
    try {
      const properties = await blobClient.getProperties();
      const fileUserId = properties.metadata?.userId;
      
      // Check if file belongs to the requesting user
      return fileUserId === userId;
    } catch (error) {
      console.error('❌ File access validation failed:', error);
      return false;
    }
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'rtf': 'application/rtf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'webm': 'video/webm'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

// Factory function to create AzureBlobStorageService with environment-based configuration
export function createAzureBlobStorageService(): AzureBlobStorageService {
  const config: AzureBlobStorageConfig = {
    accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
    useManagedIdentity: process.env.NODE_ENV === 'production' && !process.env.AZURE_STORAGE_CONNECTION_STRING,
    enableSAS: process.env.AZURE_STORAGE_ENABLE_SAS === 'true',
    sasExpiryMinutes: parseInt(process.env.AZURE_STORAGE_SAS_EXPIRY_MINUTES || '60'),
    containerNames: {
      userResumes: process.env.AZURE_STORAGE_CONTAINER_RESUMES || 'user-resumes',
      userDocuments: process.env.AZURE_STORAGE_CONTAINER_DOCUMENTS || 'user-documents',
      processedFiles: process.env.AZURE_STORAGE_CONTAINER_PROCESSED || 'processed-files',
      mediaUploads: process.env.AZURE_STORAGE_CONTAINER_MEDIA || 'media-uploads'
    }
  };

  return new AzureBlobStorageService(config);
}