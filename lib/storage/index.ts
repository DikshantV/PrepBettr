import { IStorageService, StorageProvider } from './IStorageService';
import { AzureBlobStorageService } from './providers/AzureBlobStorageService';

// Client-side safety check
const isClient = typeof window !== 'undefined';

// Only import server-side dependencies when running on server
let getConfiguration: any = null;

if (!isClient) {
  const azureConfig = require('@/lib/azure-config');
  getConfiguration = azureConfig.getConfiguration;
}

// Singleton storage service instance
let storageServiceInstance: IStorageService | null = null;

/**
 * Gets the Azure Blob Storage service instance.
 * All storage operations now use Azure exclusively.
 */
export async function getStorageService(): Promise<IStorageService> {
  if (isClient) {
    throw new Error('Storage service not available on client side');
  }
  
  if (storageServiceInstance) {
    return storageServiceInstance;
  }

  storageServiceInstance = await createAzureStorageService();
  return storageServiceInstance;
}

/**
 * Creates an Azure Blob Storage service instance with proper configuration.
 */
async function createAzureStorageService(): Promise<AzureBlobStorageService> {
  if (isClient) {
    throw new Error('Storage service not available on client side');
  }
  
  try {
    const config = await getConfiguration();
    const storageAccountName = config['AZURE_STORAGE_ACCOUNT'] || process.env.AZURE_STORAGE_ACCOUNT || 'prepbettrstorage684';
    const containerName = config['AZURE_STORAGE_CONTAINER'] || process.env.AZURE_STORAGE_CONTAINER || 'resumes';
    
    return new AzureBlobStorageService(storageAccountName, containerName);
  } catch (error) {
    console.error('Failed to create Azure storage service:', error);
    throw error;
  }
}


/**
 * Resets the singleton storage service instance.
 * Useful for testing or configuration changes.
 */
export function resetStorageService(): void {
  storageServiceInstance = null;
}

/**
 * Resume-specific utilities for backward compatibility
 */
export class ResumeStorageService {
  private storageService: IStorageService | null = null;

  async getService(): Promise<IStorageService> {
    if (!this.storageService) {
      this.storageService = await getStorageService();
    }
    return this.storageService;
  }

  /**
   * Upload a resume file with proper path organization
   */
  async uploadResume(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{ fileUrl: string; filePath: string; sasUrl?: string; provider: StorageProvider }> {
    const service = await this.getService();
    const filePath = `resumes/${userId}/${fileName}`;
    
    const result = await service.upload(fileBuffer, filePath, mimeType);
    
    return {
      fileUrl: result.url,
      filePath: result.path,
      sasUrl: result.sasUrl,
      provider: StorageProvider.Azure,
    };
  }

  /**
   * Delete a resume file
   */
  async deleteResume(filePath: string): Promise<void> {
    const service = await this.getService();
    await service.delete(filePath);
  }

  /**
   * Generate a secure URL for resume access
   */
  async getResumeUrl(filePath: string, expiresInHours: number = 24): Promise<string> {
    const service = await this.getService();
    return await service.getPublicUrl(filePath, {
      expiresIn: expiresInHours * 3600,
      accessType: 'read',
    });
  }
}

// Export singleton instance for resume operations
export const resumeStorageService = new ResumeStorageService();
