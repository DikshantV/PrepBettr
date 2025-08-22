/**
 * @file Defines the universal interface for storage services.
 * This abstraction allows for a seamless switch between different storage providers (e.g., Azure, Firebase).
 */

/**
 * Enumeration for the storage providers.
 */
export enum StorageProvider {
  Azure = 'azure',
  Firebase = 'firebase',
  Dual = 'dual', // For dual-write scenarios during migration
}

/**
 * Metadata for an uploaded file.
 */
export interface FileMeta {
  provider: StorageProvider;
  url: string; // The primary public-facing URL
  path: string; // The internal path or blob name
  sasUrl?: string; // Optional SAS URL for temporary access
  size: number;
  mimeType: string;
  createdAt: Date;
}

/**
 * Options for generating a signed or public URL.
 */
export interface SignedUrlOptions {
  expiresIn: number; // Expiration time in seconds
  accessType: 'read' | 'write';
}

/**
 * Custom error class for storage operations.
 */
export class StorageError extends Error {
  constructor(message: string, public readonly provider: StorageProvider, public readonly originalError?: any) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Defines the core contract for a storage service provider.
 */
export interface IStorageService {
  /**
   * Uploads a file to the storage provider.
   *
   * @param file The file content as a Buffer or Blob.
   * @param path The destination path for the file.
   * @param mimeType The MIME type of the file.
   * @returns A promise that resolves with the file metadata.
   */
  upload(file: Buffer | Blob, path: string, mimeType?: string): Promise<FileMeta>;

  /**
   * Downloads a file from the storage provider.
   *
   * @param path The path of the file to download.
   * @returns A promise that resolves with the file content as a Buffer.
   */
  download(path: string): Promise<Buffer>;

  /**
   * Deletes a file from the storage provider.
   *
   * @param path The path of the file to delete.
   * @returns A promise that resolves when the file is deleted.
   */
  delete(path: string): Promise<void>;

  /**
   * Generates a public or signed URL for a file.
   *
   * @param path The path of the file.
   * @param options Options for the generated URL (e.g., expiration).
   * @returns A promise that resolves with the public URL string.
   */
  getPublicUrl(path: string, options?: SignedUrlOptions): Promise<string>;
}

