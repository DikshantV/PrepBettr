# Shared Functionality Analysis

## Table of Contents
1. [Authentication Patterns](#authentication-patterns)
2. [Storage Service Duplicates](#storage-service-duplicates)
3. [Configuration Management](#configuration-management)
4. [Error Handling](#error-handling)
5. [Service Initialization](#service-initialization)
6. [Recommendations](#recommendations)

## Authentication Patterns

### Duplicate Token Verification Logic

**Firebase Client Auth** (`contexts/AuthContext.tsx`)
```typescript
// Firebase client-side authentication
const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser: FirebaseUser | null) => {
  if (firebaseUser) {
    const userData: User = convertFirebaseUserToUser(firebaseUser);
    setUser(userData);
  }
});
```

**Firebase Admin SDK Verification** (`lib/middleware/authMiddleware.ts`)
```typescript
export async function verifyFirebaseToken(idToken: string): Promise<AuthResult> {
  try {
    const decodedToken = await verifyIdToken(idToken);
    return {
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        // ... mapping logic
      }
    };
  }
}
```

**Azure Functions Auth Middleware** (`azure/shared/authMiddleware.js`)
```javascript
async function verifyFirebaseToken(idToken) {
  try {
    const auth = await initializeFirebase();
    const decodedToken = await auth.verifyIdToken(idToken, true);
    // Similar token validation logic
  }
}
```

**Firebase REST API Fallback** (`lib/services/firebase-verification.ts`)
```typescript
async verifyWithRESTAPI(idToken: string): Promise<VerificationResult> {
  const response = await fetch(`${this.FIREBASE_AUTH_URL}?key=${this.FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    body: JSON.stringify({ idToken: idToken })
  });
  // Manual token validation logic
}
```

### 🔄 **Duplication Impact**: 4 different implementations of the same Firebase token verification logic

## Storage Service Duplicates

### File Upload Patterns

**Firebase Cloud Storage** (`lib/services/firebase-resume-service.ts`)
```typescript
export async function uploadResumeToStorage(
  userId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ fileUrl: string; filePath: string }> {
  const storage = getAdminStorage();
  const bucket = storage.bucket();
  const filePath = `resumes/${userId}/${fileName}`;
  const file = bucket.file(filePath);
  
  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType,
      metadata: { userId, uploadDate: new Date().toISOString() }
    }
  });
  
  await file.makePublic();
  const fileUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  return { fileUrl, filePath };
}
```

**Azure Blob Storage** (`lib/services/azure-blob-storage.ts`)
```typescript
async uploadResume(
  userId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  const blobName = `${userId}/${Date.now()}-${fileName}`;
  const containerClient = this.blobServiceClient!.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
  await blockBlobClient.uploadData(fileBuffer, {
    blobHTTPHeaders: { blobContentType: mimeType },
    metadata: {
      userId,
      originalFileName: fileName,
      uploadDate: new Date().toISOString(),
      mimeType
    }
  });
  
  return { blobUrl, blobName, sasUrl: sasResult.sasUrl };
}
```

### 🔄 **Duplication Impact**: Nearly identical upload logic with different APIs

## Configuration Management

### Environment Variable Fallback Pattern

**Azure Key Vault with Fallback** (`lib/azure-config.ts`)
```typescript
export async function fetchAzureSecrets(): Promise<AzureSecrets> {
  try {
    const client = createKeyVaultClient();
    const secrets = await Promise.all([
      client.getSecret('speech-key'),
      client.getSecret('azure-openai-key'),
      // ... more secrets
    ]);
    
    cachedSecrets = {
      speechKey: speechKey.value!,
      azureOpenAIKey: azureOpenAIKey.value!,
      // ... mapping
    };
    
    return cachedSecrets;
  } catch (error) {
    console.log('🔄 Falling back to environment variables...');
    const fallbackSecrets: AzureSecrets = {
      speechKey: process.env.AZURE_SPEECH_KEY || '',
      azureOpenAIKey: process.env.AZURE_OPENAI_KEY || '',
      // ... fallback mapping
    };
    return fallbackSecrets;
  }
}
```

**Firebase Admin Config** (`firebase/admin.ts`)
```typescript
const loadFirebasePrivateKey = (): string => {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  if (!privateKey || privateKey.length < 100) {
    console.log('🔍 Private key seems truncated, attempting manual load from .env.local...');
    // Manual .env.local reading logic
  }
  
  return privateKey || '';
};
```

### 🔄 **Duplication Impact**: Similar fallback patterns implemented separately

## Error Handling

### Service Initialization Error Patterns

**Azure Service Initialization** (`lib/services/azure-speech-service.ts`)
```typescript
async initialize(): Promise<boolean> {
  try {
    const secrets = await fetchAzureSecrets();
    
    if (!secrets.speechKey || !secrets.speechEndpoint) {
      console.warn('⚠️ Azure Speech credentials not available');
      return false;
    }
    
    // Service-specific initialization
    this.isInitialized = true;
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Azure Speech Service:', error);
    return false;
  }
}
```

**Firebase Service Initialization** (`firebase/admin.ts`)
```typescript
const initFirebaseAdmin = (): FirebaseAdmin => {
  try {
    // Validate all required environment variables first
    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missingVars.length > 0) {
      console.warn(`Missing required environment variables: ${missingVars.join(', ')}`);
      return mockServices;
    }
    
    // Service-specific initialization
    return { app, auth, db, storage };
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw new Error(`Failed to initialize Firebase Admin: ${error.message}`);
  }
};
```

### 🔄 **Duplication Impact**: Similar error handling and logging patterns across services

## Service Initialization

### Lazy Loading Pattern

**Firebase Admin Lazy Loading** (`firebase/admin.ts`)
```typescript
let firebaseAdmin: FirebaseAdmin | null = null;

const getFirebaseAdmin = (): FirebaseAdmin => {
  if (!firebaseAdmin) {
    firebaseAdmin = initFirebaseAdmin();
  }
  return firebaseAdmin;
};

export const auth = new Proxy({} as any, {
  get: (target, prop) => {
    const admin = ensureInitialized();
    return (admin.auth as any)[prop];
  }
});
```

**Azure Service Lazy Loading** (`lib/services/azure-openai-service.ts`)
```typescript
export class AzureOpenAIService {
  private client: OpenAI | null = null;
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    if (this.isInitialized && this.client) {
      return true;
    }
    // Initialization logic
  }
}

export const azureOpenAIService = new AzureOpenAIService();
```

### 🔄 **Duplication Impact**: Different patterns for lazy initialization and service management

## Recommendations

### 1. **Unified Authentication Service**
Create a single `AuthenticationService` class that:
- Handles both Firebase and Azure authentication methods
- Provides consistent interface for token verification
- Implements fallback strategies transparently
- Centralizes authentication error handling

### 2. **Abstract Storage Service**
Implement a `StorageServiceInterface` with:
- Unified upload/download/delete methods
- Provider-agnostic API (Firebase vs Azure)
- Automatic fallback between providers
- Consistent metadata handling

### 3. **Configuration Manager**
Consolidate into a single `ConfigurationService`:
- Unified secret management (Key Vault → environment variables)
- Provider-specific configuration mapping
- Consistent caching and fallback strategies
- Environment-specific overrides

### 4. **Service Registry Pattern**
Implement a `ServiceRegistry` that:
- Manages all service instances (Firebase, Azure)
- Handles service initialization order and dependencies
- Provides health checking across all services
- Manages service lifecycle and cleanup

### 5. **Unified Error Handling**
Create consistent error handling with:
- Standardized error types and codes
- Provider-agnostic error mapping
- Centralized logging and monitoring
- Retry strategies and circuit breakers

### Files to Consolidate

| Pattern | Firebase Files | Azure Files | Suggested Unified File |
|---------|---------------|-------------|----------------------|
| **Authentication** | `lib/middleware/authMiddleware.ts`<br>`firebase/admin.ts`<br>`lib/services/firebase-verification.ts` | `azure/shared/authMiddleware.js`<br>`lib/azure-config.ts` | `lib/services/unified-auth.service.ts` |
| **Storage** | `lib/services/firebase-resume-service.ts` | `lib/services/azure-blob-storage.ts` | `lib/services/unified-storage.service.ts` |
| **Configuration** | `firebase/client.ts`<br>`firebase/admin.ts` | `lib/azure-config.ts`<br>`lib/azure-startup.ts` | `lib/services/unified-config.service.ts` |

### Estimated Consolidation Effort
- **High Priority**: Authentication (4 implementations → 1)
- **Medium Priority**: Storage (2 implementations → 1)  
- **Low Priority**: Configuration (6 files → 1-2 files)
