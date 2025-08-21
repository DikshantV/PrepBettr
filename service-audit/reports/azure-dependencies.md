# Azure Dependencies Inventory

## Table of Contents
1. [Overview](#overview)
2. [Azure Packages](#azure-packages)
3. [Service Breakdown](#service-breakdown)
4. [Import Analysis](#import-analysis)
5. [Critical Dependencies](#critical-dependencies)
6. [File-by-File Analysis](#file-by-file-analysis)

## Overview

### Summary Statistics
- **Total Files**: 121 files with Azure dependencies
- **Import Statements**: 85 direct Azure imports
- **Service Usage**: 801 Azure service calls
- **Package Dependencies**: 12 Azure packages

### Azure Services in Use
- 🔑 **Azure Key Vault** - Centralized secrets management
- 🧠 **Azure OpenAI** - AI conversation and content generation
- 🎤 **Azure Speech Services** - Speech-to-text and text-to-speech
- 📦 **Azure Blob Storage** - File storage alternative to Firebase
- ⚡ **Azure Functions** - Serverless backend processing
- 🗃️ **Azure Cosmos DB** - NoSQL database for specific use cases
- 📊 **Azure Application Insights** - Monitoring and telemetry
- 📋 **Azure Form Recognizer** - Document processing (planned)

## Azure Packages

### Core Dependencies
From `package.json`:
```json
{
  "@azure/ai-form-recognizer": "^5.1.0",
  "@azure/app-configuration": "^1.9.0",
  "@azure/cosmos": "^4.5.0",
  "@azure/identity": "^4.11.1",
  "@azure/keyvault-secrets": "^4.10.0",
  "@azure/storage-blob": "^12.28.0",
  "microsoft-cognitiveservices-speech-sdk": "^1.45.0",
  "applicationinsights": "^3.9.0"
}
```

From `azure/package.json`:
```json
{
  "@azure/functions": "^4.0.0",
  "@azure/identity": "^4.10.2",
  "@azure/keyvault-secrets": "^4.10.0",
  "@azure/app-configuration": "^1.5.0",
  "@azure/storage-queue": "^12.17.0",
  "@azure/storage-blob": "^12.28.0",
  "@azure/cosmos": "^4.2.0",
  "@azure/monitor-ingestion": "^1.0.0",
  "@azure/monitor-query": "^1.2.0",
  "microsoft-cognitiveservices-speech-sdk": "^1.45.0"
}
```

### Monitoring Dependencies
```json
{
  "@microsoft/applicationinsights-clickanalytics-js": "^3.3.9",
  "@microsoft/applicationinsights-react-js": "^19.3.7",
  "@microsoft/applicationinsights-web": "^3.3.9"
}
```

## Service Breakdown

### 🔑 Azure Key Vault (15+ files)

#### Core Implementation
- **`lib/azure-config.ts`** - Primary Key Vault integration and fallback logic
- **`lib/azure-startup.ts`** - Service initialization orchestration
- **`azure/lib/azure-config.ts`** - Azure Functions variant

#### Authentication Integration
- **`azure/shared/authMiddleware.js`** - Fetches Firebase secrets from Key Vault
- **`azure/TokenRefreshTimer/index.js`** - OAuth token refresh using stored secrets

#### Secret Categories
- **Speech Services**: `speech-key`, `speech-endpoint`
- **Azure OpenAI**: `azure-openai-key`, `azure-openai-endpoint`, `azure-openai-deployment`
- **Firebase Secrets**: `firebase-project-id`, `firebase-client-email`, `firebase-private-key`
- **Storage**: `azure-storage-account-name`, `azure-storage-account-key`
- **Form Recognition**: `azure-form-recognizer-key`, `azure-form-recognizer-endpoint`

### 🧠 Azure OpenAI (25+ files)

#### Core Service Implementation
- **`lib/services/azure-openai-service.ts`** - Main OpenAI service class
- **`lib/services/azure-openai-enhanced.ts`** - Enhanced features and optimizations
- **`lib/ai/azureOpenAI.ts`** - AI utility functions

#### Voice Interview Integration
- **`components/Agent.tsx`** - Voice interview orchestrator using Azure OpenAI
- **Azure Functions**: Multiple workers using OpenAI for job processing

#### Use Cases
- **Voice Interviews**: Real-time conversation generation
- **Resume Tailoring**: Job-specific resume optimization  
- **Cover Letter Generation**: AI-powered cover letter creation
- **Job Relevancy Scoring**: Automated job matching algorithms

### 🎤 Azure Speech Services (10+ files)

#### Core Implementation
- **`lib/services/azure-speech-service.ts`** - Speech-to-text and text-to-speech service
- **`components/Agent.tsx`** - Voice interview integration

#### Configuration Features
- **Speech Recognition**: Continuous recognition with silence detection
- **Speech Synthesis**: Neural voice with SSML support
- **Audio Processing**: Real-time audio buffer handling

#### Voice Profiles
- **Recognition**: `en-US` with conversation mode
- **Synthesis**: `en-US-AriaNeural`, `en-US-SaraNeural` voices
- **Format**: 24kHz 48kbit MP3 for optimal quality/bandwidth

### 📦 Azure Blob Storage (8 files)

#### Implementation
- **`lib/services/azure-blob-storage.ts`** - Blob storage service with SAS token generation
- **Alternative to Firebase Storage** for file uploads

#### Container Structure
- `user-resumes` - Resume files with SAS access
- `profile-pictures` - Public profile images
- `user-documents` - General document storage

### ⚡ Azure Functions (35+ files)

#### Function Categories

**Queue Processors**:
- `azure/followUpWorker/` - Interview follow-up processing
- `azure/applicationWorker/` - Job application automation
- `azure/jobSearchWorker/` - Job discovery and matching
- `azure/searchScheduler/` - Search result processing
- `azure/notificationScheduler/` - User notification processing

**Data Management**:
- `azure/deleteUserData/` - GDPR user data deletion
- `azure/processScheduledDeletions/` - Scheduled cleanup operations
- `azure/processGDPRScheduledDeletions/` - GDPR compliance processing

**Authentication**:
- `azure/verifyToken/` - Token verification endpoint
- `azure/createSessionCookie/` - Session cookie generation

**Utilities**:
- `azure/health/` - Health check endpoint
- `azure/TokenRefreshTimer/` - OAuth token refresh automation

### 🗃️ Azure Cosmos DB (5 files)

#### Usage Pattern
- **GDPR Functions**: User data deletion tracking
- **Scheduled Operations**: Cleanup and maintenance tasks
- **Document Storage**: Alternative to Firestore for specific use cases

### 📊 Azure Application Insights (8 files)

#### Telemetry Integration
- **`components/providers/TelemetryProvider.tsx`** - React telemetry wrapper
- **Frontend Tracking**: Click analytics, user behavior, performance metrics
- **Backend Monitoring**: Function execution times, error rates, dependency health

## Import Analysis

### Most Common Azure Imports

#### Core Azure SDKs
```typescript
// Identity and Key Vault
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

// Storage
import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob';
import { QueueServiceClient } from '@azure/storage-queue';

// Database  
import { CosmosClient } from '@azure/cosmos';

// Functions
import { app } from '@azure/functions';
```

#### AI and Cognitive Services
```typescript
// Speech Services
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

// OpenAI (via openai package)
import OpenAI from 'openai';

// Application Insights
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
```

### Import Distribution by Layer
- **Backend Functions (45 imports)**: Azure Functions, Key Vault, storage services
- **Shared Services (25 imports)**: Configuration, AI services, monitoring
- **Frontend (15 imports)**: Application Insights, client-side telemetry

## Critical Dependencies

### High-Impact Services

#### 🚨 **Critical Path Services** (Core functionality)
1. **Azure Key Vault** - All other Azure services depend on secrets from here
2. **Azure OpenAI** - Core AI functionality for voice interviews and content generation
3. **Azure Speech Services** - Essential for voice interview feature

#### ⚠️ **High-Impact Services** (Major features)
1. **Azure Functions** - Backend processing orchestration
2. **Azure Application Insights** - Production monitoring and debugging

### Service Dependency Chain
```
Azure Key Vault → Speech Services → Voice Interviews
Azure Key Vault → OpenAI → AI Processing
Azure Key Vault → Firebase Secrets → Authentication
```

**Single Point of Failure**: Azure Key Vault outage affects all Azure services

## File-by-File Analysis

### Backend Functions Layer (45 files)

#### Core Azure Functions
| File | Azure Services | Usage Pattern | Risk Level |
|------|---------------|---------------|------------|
| `azure/shared/authMiddleware.js` | Key Vault, Identity | Cross-service authentication | 🔴 **CRITICAL** |
| `azure/deleteUserData/index.js` | Cosmos DB, Blob Storage, Key Vault | GDPR compliance | 🟡 **MEDIUM** |
| `azure/followUpWorker/index.js` | Functions, OpenAI, Queue Storage | Interview processing | 🔴 **HIGH** |
| `azure/health/index.js` | Functions runtime | Service health monitoring | 🟢 **LOW** |

#### Data Processing Workers
| File | Azure Services | Usage Pattern | Risk Level |
|------|---------------|---------------|------------|
| `azure/applicationWorker/index.js` | OpenAI, Queue Storage | Job application AI | 🟡 **MEDIUM** |
| `azure/jobSearchWorker/index.js` | Queue Storage, potential AI | Job discovery | 🟢 **LOW** |
| `azure/searchScheduler/index.js` | Functions, Queue Storage | Search orchestration | 🟢 **LOW** |

### Shared Services Layer (25 files)

#### Configuration Management
| File | Azure Services | Usage Pattern | Risk Level |
|------|---------------|---------------|------------|
| `lib/azure-config.ts` | Key Vault, Identity | Secret management | 🔴 **CRITICAL** |
| `lib/azure-startup.ts` | Configuration initialization | Service orchestration | 🔴 **HIGH** |
| `lib/azure-config-browser.ts` | Browser-compatible config | Frontend configuration | 🟡 **MEDIUM** |

#### AI Services
| File | Azure Services | Usage Pattern | Risk Level |
|------|---------------|---------------|------------|
| `lib/services/azure-openai-service.ts` | OpenAI via Azure | AI conversation engine | 🔴 **CRITICAL** |
| `lib/services/azure-speech-service.ts` | Speech Services SDK | Voice processing | 🔴 **CRITICAL** |
| `lib/services/azure-ai-service.ts` | Multiple AI services | AI orchestration | 🟡 **MEDIUM** |

#### Storage and Database
| File | Azure Services | Usage Pattern | Risk Level |
|------|---------------|---------------|------------|
| `lib/services/azure-blob-storage.ts` | Blob Storage | File management | 🟡 **MEDIUM** |
| `lib/services/azure-cosmos-service.ts` | Cosmos DB | Document operations | 🟡 **MEDIUM** |

### Frontend Layer (15 files)

#### Monitoring Integration
| File | Azure Services | Usage Pattern | Risk Level |
|------|---------------|---------------|------------|
| `components/providers/TelemetryProvider.tsx` | Application Insights | User behavior tracking | 🟢 **LOW** |
| `app/layout.tsx` | Application Insights | App-wide telemetry | 🟡 **MEDIUM** |

## Configuration Dependencies

### Environment Variables Required
```bash
# Azure Key Vault
AZURE_KEY_VAULT_URI=https://prepbettr-keyvault-083.vault.azure.net/

# Azure Speech Services
NEXT_PUBLIC_SPEECH_KEY=***
NEXT_PUBLIC_SPEECH_ENDPOINT=https://eastus2.api.cognitive.microsoft.com/
NEXT_PUBLIC_SPEECH_REGION=eastus2

# Azure OpenAI
AZURE_OPENAI_KEY=***
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
NEXT_PUBLIC_AZURE_OPENAI_API_KEY=***
NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT=***

# Azure Storage (Optional)
AZURE_STORAGE_ACCOUNT_NAME=***
AZURE_STORAGE_ACCOUNT_KEY=***

# Azure Application Insights
NEXT_PUBLIC_AZURE_APPLICATION_INSIGHTS_INSTRUMENTATION_KEY=***

# Azure Functions
AZURE_FUNCTION_KEY=***
```

### Azure Configuration Files
- `azure/host.json` - Azure Functions host configuration
- `azure/local.settings.json` - Local development settings
- `azure/deploy.sh` - Deployment automation script

## Testing and Development

### Health Check Integration
```typescript
// Health check endpoints for Azure services
'/api/health/azure' - Azure services status
'azure/health/index.js' - Function app health endpoint
```

### Development Tools
```bash
# Azure Functions development
npm run deploy:azure:functions
cd azure && func start

# Azure service health checks
npm run check:azure
npm run test:azure-health
```

## Service Dependencies

### Primary Dependencies
1. **Azure Key Vault → All Azure Services** (secrets dependency)
2. **Azure OpenAI → Voice Interview System** (core AI functionality)  
3. **Azure Speech → Voice Interview System** (audio processing)
4. **Azure Functions → Backend Processing** (serverless orchestration)

### Fallback Dependencies
1. **Azure Key Vault → Environment Variables** (fallback configuration)
2. **Azure Blob Storage → Firebase Storage** (storage failover)
3. **Azure OpenAI → Fallback Responses** (AI service degradation)

## Integration Patterns

### Azure-to-Firebase Bridge
Multiple Azure Functions access Firebase services:
```javascript
// azure/shared/authMiddleware.js
const auth = await initializeFirebase(); // Firebase Admin in Azure Function
const decodedToken = await auth.verifyIdToken(idToken);
```

### Hybrid Storage Strategy
```typescript
// Storage service selection
const storageProvider = process.env.STORAGE_PROVIDER || 'firebase';
if (storageProvider === 'azure') {
  await azureBlobStorage.uploadResume(/* params */);
} else {
  await uploadResumeToStorage(/* params */); // Firebase
}
```

## Critical Dependencies

### Single Points of Failure

#### 🔑 **Azure Key Vault**
**Impact**: All Azure services become unavailable
**Mitigation**: Environment variable fallback in `lib/azure-config.ts`
**Files Affected**: 15+ files across backend functions

#### 🧠 **Azure OpenAI**  
**Impact**: Voice interviews and AI features stop working
**Mitigation**: Fallback response system in `azure-openai-service.ts`
**Files Affected**: 25+ files including core voice interview system

#### 🎤 **Azure Speech Services**
**Impact**: Voice interview feature completely unavailable  
**Mitigation**: Limited - this is a core differentiating feature
**Files Affected**: 10+ files in voice interview pipeline

### High-Impact Files

#### 🚨 **Critical Path Files**
1. **`lib/azure-config.ts`** - All Azure service configuration
2. **`lib/services/azure-openai-service.ts`** - Core AI conversation engine
3. **`lib/services/azure-speech-service.ts`** - Voice processing engine
4. **`components/Agent.tsx`** - Main voice interview orchestrator

#### ⚠️ **High-Impact Files**  
1. **`azure/shared/authMiddleware.js`** - Cross-service authentication
2. **`lib/azure-startup.ts`** - Service initialization coordination
3. **`azure/followUpWorker/index.js`** - Interview processing automation

## Migration Considerations

### Azure Service Portability

| Service | Portability | Alternative Providers | Migration Effort |
|---------|-------------|---------------------|------------------|
| **Azure OpenAI** | 🟢 **HIGH** | OpenAI API, Anthropic, Google | **LOW** - Standard OpenAI API |
| **Azure Speech** | 🟡 **MEDIUM** | Google Speech, AWS Polly | **HIGH** - Different APIs |
| **Azure Key Vault** | 🟡 **MEDIUM** | AWS Secrets Manager, HashiCorp Vault | **MEDIUM** - Standard secret patterns |
| **Azure Blob Storage** | 🟢 **HIGH** | AWS S3, Google Cloud Storage | **LOW** - Standard blob operations |
| **Azure Functions** | 🟡 **MEDIUM** | AWS Lambda, Vercel Functions | **MEDIUM** - Runtime differences |
| **Azure Cosmos DB** | 🔴 **LOW** | MongoDB, DynamoDB | **HIGH** - Query syntax differences |
| **Application Insights** | 🟢 **HIGH** | Google Analytics, DataDog | **LOW** - Standard metrics |

### Migration Complexity Assessment

#### 🟢 **Low Complexity** (1-2 weeks)
- Switch from Azure OpenAI to standard OpenAI API
- Migrate from Azure Blob Storage to AWS S3
- Replace Application Insights with alternative monitoring

#### 🟡 **Medium Complexity** (1-2 months)  
- Migrate Azure Functions to AWS Lambda
- Replace Azure Key Vault with AWS Secrets Manager
- Switch from Azure Speech to Google Speech API

#### 🔴 **High Complexity** (3-6 months)
- Migrate from Azure Cosmos DB to alternative NoSQL database
- Replace entire Azure Functions backend with different serverless platform

## Security Considerations

### Secret Management Flow
```
Azure Key Vault (Primary) → Environment Variables (Fallback) → Application Services
```

### Access Patterns
- **Azure Functions**: Use Managed Identity for Key Vault access
- **Next.js Application**: Uses DefaultAzureCredential in production
- **Development**: Falls back to environment variables

### Key Rotation Strategy
- **Azure Key Vault**: Supports automatic key rotation
- **Environment Variables**: Manual rotation required
- **Cache Invalidation**: `clearAzureSecretsCache()` for cache refresh

## Performance Considerations

### Service Initialization Times
- **Azure Key Vault**: 200-500ms (cached after first load)
- **Azure OpenAI**: 100-300ms per request
- **Azure Speech**: 500-1000ms for recognition setup
- **Azure Blob Storage**: 50-200ms per operation

### Optimization Strategies
- **Secret Caching**: Implemented in `azure-config.ts`
- **Connection Pooling**: OpenAI client reuse
- **Regional Deployment**: Use closest Azure region to users

## Monitoring and Health Checks

### Azure Service Health Endpoints
```bash
# Application health checks
/api/health - Overall system health
/api/health/azure - Azure services specific status

# Azure Functions health
https://prepbettr-functions-app.azurewebsites.net/api/health
```

### Telemetry Integration
- **Application Insights**: Automatic dependency tracking
- **Custom Metrics**: Service initialization success rates
- **Error Tracking**: Failed API calls and timeouts

## Development Workflow

### Local Development
```bash
# Start Azure Functions locally
cd azure && func start

# Test Azure service health
npm run check:azure

# Deploy to Azure
npm run deploy:azure:functions
```

### CI/CD Integration
```bash
# Azure deployment checks
npm run deploy:check:production

# Azure Functions deployment
npm run deploy:azure:all
```

## Next Steps

### Immediate Actions
1. **Service Health Monitoring** - Implement comprehensive health checks
2. **Documentation Update** - Ensure all Azure service configurations are documented
3. **Error Handling Review** - Standardize error handling across all Azure services

### Cross-Reference
- See [Firebase Dependencies](firebase-dependencies.md) for Firebase service analysis
- See [Shared Functionality](shared-functionality.md) for duplication analysis
- See [Risk Assessment](risk-assessment.md) for migration planning
