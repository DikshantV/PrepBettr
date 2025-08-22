import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { trace } from '@opentelemetry/api';

import { IStorageService, FileMeta, SignedUrlOptions, StorageProvider, StorageError } from '../IStorageService';
import { getConfiguration } from '@/lib/azure-config';

const TRACER_NAME = 'AzureBlobStorageService';

export class AzureBlobStorageService implements IStorageService {
  private containerClient: ContainerClient;
  private storageAccountName: string;
  private isInitialized = false;

  constructor(storageAccountName: string, private containerName: string) {
    this.storageAccountName = storageAccountName;
    const blobServiceUrl = `https://${this.storageAccountName}.blob.core.windows.net`;

    // Use DefaultAzureCredential in production, fallback to connection string for local dev
    const credential = process.env.AZURE_STORAGE_CONNECTION_STRING
      ? new StorageSharedKeyCredential(this.storageAccountName, process.env.AZURE_STORAGE_ACCOUNT_KEY!)
      : new DefaultAzureCredential();

    const blobServiceClient = new BlobServiceClient(blobServiceUrl, credential);
    this.containerClient = blobServiceClient.getContainerClient(this.containerName);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const tracer = trace.getTracer(TRACER_NAME);
    const span = tracer.startSpan('initialize');

    try {
      await this.containerClient.createIfNotExists(); // Private access by default
      this.isInitialized = true;
      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
      throw new StorageError('Failed to initialize Azure Blob Storage container', StorageProvider.Azure, error);
    } finally {
      span.end();
    }
  }

  async upload(file: Buffer, path: string, mimeType?: string): Promise<FileMeta> {
    await this.initialize();
    const blockBlobClient = this.containerClient.getBlockBlobClient(path);

    const tracer = trace.getTracer(TRACER_NAME);
    const span = tracer.startSpan('upload');
    span.setAttributes({ path, mimeType, size: file.length });

    try {
      await blockBlobClient.upload(file, file.length, { blobHTTPHeaders: { blobContentType: mimeType } });
      const fileMeta: FileMeta = {
        provider: StorageProvider.Azure,
        url: blockBlobClient.url,
        path,
        size: file.length,
        mimeType: mimeType || 'application/octet-stream',
        createdAt: new Date(),
      };
      span.setStatus({ code: 1 });
      return fileMeta;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      throw new StorageError(`Failed to upload to Azure Blob Storage: ${path}`, StorageProvider.Azure, error);
    } finally {
      span.end();
    }
  }

  async download(path: string): Promise<Buffer> {
    await this.initialize();
    const blockBlobClient = this.containerClient.getBlockBlobClient(path);

    const tracer = trace.getTracer(TRACER_NAME);
    const span = tracer.startSpan('download');
    span.setAttribute('path', path);

    try {
      const buffer = await blockBlobClient.downloadToBuffer();
      span.setStatus({ code: 1 });
      return buffer;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      throw new StorageError(`Failed to download from Azure Blob Storage: ${path}`, StorageProvider.Azure, error);
    } finally {
      span.end();
    }
  }

  async delete(path: string): Promise<void> {
    await this.initialize();
    const blockBlobClient = this.containerClient.getBlockBlobClient(path);

    const tracer = trace.getTracer(TRACER_NAME);
    const span = tracer.startSpan('delete');
    span.setAttribute('path', path);

    try {
      await blockBlobClient.delete();
      span.setStatus({ code: 1 });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      throw new StorageError(`Failed to delete from Azure Blob Storage: ${path}`, StorageProvider.Azure, error);
    } finally {
      span.end();
    }
  }

  async getPublicUrl(path: string, options?: SignedUrlOptions): Promise<string> {
    await this.initialize();
    const blockBlobClient = this.containerClient.getBlockBlobClient(path);

    const permissions = new BlobSASPermissions();
    permissions.read = options?.accessType === 'read' || !options?.accessType;
    permissions.write = options?.accessType === 'write';

    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + (options?.expiresIn || 3600)); // Default to 1 hour

    const sasQueryParameters = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: path,
        permissions,
        startsOn: new Date(),
        expiresOn: expiryDate,
      },
      this.containerClient.credential as StorageSharedKeyCredential
    );

    return `${blockBlobClient.url}?${sasQueryParameters.toString()}`;
  }
}

