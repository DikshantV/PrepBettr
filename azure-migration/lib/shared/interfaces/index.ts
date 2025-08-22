/**
 * Core Service Interfaces for Azure-Centric Architecture
 * 
 * These interfaces enable provider-agnostic service implementations
 * supporting gradual migration from Firebase to Azure services.
 */

// ===== AUTHENTICATION INTERFACES =====

export interface AuthUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified: boolean;
  roles?: string[];
  custom_claims?: Record<string, any>;
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  refreshToken?: string;
}

export interface AuthVerificationResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  method: 'firebase-admin' | 'firebase-rest' | 'azure-ad';
}

export interface IAuthService {
  verifyToken(token: string): Promise<AuthVerificationResult>;
  createUser(userData: Partial<AuthUser>): Promise<AuthUser>;
  updateUser(uid: string, userData: Partial<AuthUser>): Promise<void>;
  deleteUser(uid: string): Promise<void>;
  getUser(uid: string): Promise<AuthUser | null>;
  setCustomClaims(uid: string, claims: Record<string, any>): Promise<void>;
}

// ===== STORAGE INTERFACES =====

export interface StorageFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  metadata?: Record<string, string>;
  uploadedAt: Date;
  userId?: string;
}

export interface UploadOptions {
  metadata?: Record<string, string>;
  generatePublicUrl?: boolean;
  expiryHours?: number;
}

export interface UploadResult {
  file: StorageFile;
  publicUrl?: string;
  sasUrl?: string;
}

export interface IStorageService {
  upload(
    container: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
    options?: UploadOptions
  ): Promise<UploadResult>;
  
  download(container: string, fileName: string): Promise<Buffer>;
  delete(container: string, fileName: string): Promise<void>;
  generateSignedUrl(container: string, fileName: string, expiryHours?: number): Promise<string>;
  listFiles(container: string, prefix?: string): Promise<StorageFile[]>;
  getFileMetadata(container: string, fileName: string): Promise<StorageFile>;
}

// ===== DATABASE INTERFACES =====

export interface QueryFilter {
  field: string;
  operator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'array-contains';
  value: any;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
}

export interface DatabaseDocument {
  id: string;
  data: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IDocumentService {
  get(collection: string, documentId: string): Promise<DatabaseDocument | null>;
  create(collection: string, data: Record<string, any>, documentId?: string): Promise<string>;
  update(collection: string, documentId: string, data: Record<string, any>): Promise<void>;
  delete(collection: string, documentId: string): Promise<void>;
  query(collection: string, options?: QueryOptions): Promise<DatabaseDocument[]>;
  subscribe(
    collection: string, 
    documentId: string,
    callback: (doc: DatabaseDocument | null) => void
  ): () => void;
  subscribeToQuery(
    collection: string,
    options: QueryOptions,
    callback: (docs: DatabaseDocument[]) => void
  ): () => void;
}

// ===== CONFIGURATION INTERFACES =====

export interface ConfigValue {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  environment?: string;
  lastUpdated?: Date;
}

export interface IConfigService {
  get(key: string, defaultValue?: any): Promise<any>;
  set(key: string, value: any, environment?: string): Promise<void>;
  getAll(prefix?: string): Promise<Record<string, any>>;
  refresh(): Promise<void>;
  subscribe(key: string, callback: (value: any) => void): () => void;
}

// ===== FUNCTIONS/SERVERLESS INTERFACES =====

export interface FunctionContext {
  requestId: string;
  user?: AuthUser;
  logger: {
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
  };
}

export interface FunctionRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

export interface FunctionResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: any;
}

export interface IFunctionService {
  invoke(functionName: string, payload: any): Promise<any>;
  deploy(functionName: string, code: string): Promise<void>;
  getLogs(functionName: string, limit?: number): Promise<string[]>;
}

// ===== AI/COGNITIVE SERVICES INTERFACES =====

export interface SpeechToTextResult {
  text: string;
  confidence: number;
  duration: number;
}

export interface TextToSpeechOptions {
  voice?: string;
  language?: string;
  speed?: number;
}

export interface ChatCompletionRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ISpeechService {
  speechToText(audioBuffer: Buffer, options?: any): Promise<SpeechToTextResult>;
  textToSpeech(text: string, options?: TextToSpeechOptions): Promise<Buffer>;
}

export interface IAIService {
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  generateEmbedding(text: string): Promise<number[]>;
}

// ===== PROVIDER FACTORY INTERFACE =====

export interface ServiceProvider {
  name: 'firebase' | 'azure';
  auth?: IAuthService;
  storage?: IStorageService;
  database?: IDocumentService;
  config?: IConfigService;
  functions?: IFunctionService;
  speech?: ISpeechService;
  ai?: IAIService;
}

export interface IServiceFactory {
  getProvider(name: 'firebase' | 'azure'): ServiceProvider;
  getAuthService(provider?: 'firebase' | 'azure'): IAuthService;
  getStorageService(provider?: 'firebase' | 'azure'): IStorageService;
  getDatabaseService(provider?: 'firebase' | 'azure'): IDocumentService;
  getConfigService(provider?: 'firebase' | 'azure'): IConfigService;
  getFunctionService(provider?: 'firebase' | 'azure'): IFunctionService;
  getSpeechService(provider?: 'firebase' | 'azure'): ISpeechService;
  getAIService(provider?: 'firebase' | 'azure'): IAIService;
}

// ===== MIGRATION SUPPORT INTERFACES =====

export interface MigrationState {
  service: string;
  sourceProvider: 'firebase';
  targetProvider: 'azure';
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back';
  startedAt?: Date;
  completedAt?: Date;
  progress?: number;
  error?: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  environment: string;
  conditions?: Record<string, any>;
}

export interface IMigrationService {
  getMigrationState(service: string): Promise<MigrationState>;
  startMigration(service: string): Promise<void>;
  rollbackMigration(service: string): Promise<void>;
  getFeatureFlag(key: string): Promise<FeatureFlag>;
  setFeatureFlag(key: string, flag: Partial<FeatureFlag>): Promise<void>;
}
