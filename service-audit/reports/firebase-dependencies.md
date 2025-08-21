# Firebase Dependencies Inventory

## Table of Contents
1. [Overview](#overview)
2. [Firebase Packages](#firebase-packages)
3. [Service Breakdown](#service-breakdown)
4. [Import Analysis](#import-analysis)
5. [Critical Dependencies](#critical-dependencies)
6. [File-by-File Analysis](#file-by-file-analysis)

## Overview

### Summary Statistics
- **Total Files**: 169 files with Firebase dependencies
- **Import Statements**: 65 direct Firebase imports
- **Service Usage**: 1,571 Firebase service calls
- **Package Dependencies**: 5 core Firebase packages

### Firebase Services in Use
- 🔐 **Firebase Authentication** - User authentication and session management
- 🗄️ **Firestore Database** - Primary data storage with real-time sync
- 📁 **Firebase Cloud Storage** - File storage for resumes and documents
- ⚙️ **Firebase Admin SDK** - Server-side operations and token verification
- 🔧 **Firebase Functions** - Legacy serverless functions (minimal usage)

## Firebase Packages

### Core Dependencies
From `package.json`:
```json
{
  "firebase": "^11.7.1",
  "firebase-admin": "^13.4.0"
}
```

From `azure/package.json`:
```json
{
  "firebase-admin": "^13.4.0"
}
```

### Dev Dependencies
```json
{
  "@firebase/rules-unit-testing": "^4.0.0",
  "firebase-tools": "^13.0.2"
}
```

## Service Breakdown

### 🔐 Firebase Authentication (65+ files)

#### Core Implementation Files
- **`contexts/AuthContext.tsx`** - Main authentication context provider
- **`lib/middleware/authMiddleware.ts`** - API route authentication middleware
- **`firebase/admin.ts`** - Server-side Firebase Admin SDK initialization
- **`lib/services/firebase-verification.ts`** - Token verification with REST fallback

#### Frontend Authentication Components
- `components/AuthForm.tsx` - Sign-in/sign-up forms
- `components/GoogleSignInButton.tsx` - Google OAuth integration
- `components/AuthSync.tsx` - Client/server auth synchronization
- `components/authenticated-layout.tsx` - Protected layout wrapper

#### Authentication Hooks and Utilities
- `hooks/useFirebase.ts` - Firebase client initialization hook
- `lib/utils/firebase-auth-debug.ts` - Authentication debugging utilities

### 🗄️ Firestore Database (45+ files)

#### Database Access Patterns
- **`lib/hooks/useFirestore.ts`** - Client-side Firestore queries
- **`lib/hooks/useRealtimeFirestore.ts`** - Real-time data synchronization
- **Security Rules**: `firestore.rules` - Database security configuration

#### Data Collections
- `users` - User profile and settings data
- `interviews` - Interview sessions and results
- `resumes` - Resume metadata and extracted content
- `feedback` - Interview feedback and scoring
- `usage` - User quota and licensing data
- `applications` - Job application tracking
- `mockInterviews` - Community interview templates

### 📁 Firebase Cloud Storage (15+ files)

#### Storage Implementation
- **`lib/services/firebase-resume-service.ts`** - Resume upload/download service
- **`components/PdfUploadButton.tsx`** - File upload component with Firebase integration

#### Storage Buckets
- `resumes/` - User resume files
- `profile-pictures/` - User profile images
- `documents/` - General document storage

### ⚙️ Firebase Admin SDK (25+ files)

#### Server-side Operations
- **`firebase/admin.ts`** - Main admin SDK initialization
- **`azure/shared/authMiddleware.js`** - Azure Functions authentication
- **Server actions** - All files in `lib/actions/`

#### Known Issues
- **gRPC SSL Compatibility**: Node.js 20+ OpenSSL 3.x issues
- **Workarounds**: `FIRESTORE_PREFER_REST=true`, `--openssl-legacy-provider`

## Import Analysis

### Most Common Imports

#### Firebase Client SDK
```typescript
// Authentication
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";

// Firestore
import { getFirestore } from "firebase/firestore";
import { collection, doc, getDoc, getDocs, query, where, orderBy } from "firebase/firestore";

// App initialization
import { initializeApp, getApp, getApps } from "firebase/app";
```

#### Firebase Admin SDK
```typescript
// Admin initialization
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

// Firestore operations
import { FieldValue } from 'firebase-admin/firestore';
```

### Import Distribution by Layer
- **Frontend (85 imports)**: Auth components, Firestore hooks, storage utilities
- **Backend (35 imports)**: Admin SDK, server actions, API routes
- **Shared (25 imports)**: Type definitions, utility functions

## Critical Dependencies

### High-Impact Files

#### 🚨 **Critical Path Files** (App fails if these break)
1. **`firebase/admin.ts`** - Core server-side Firebase initialization
2. **`contexts/AuthContext.tsx`** - Frontend authentication state management
3. **`lib/middleware/authMiddleware.ts`** - API route protection
4. **`firebase/client.ts`** - Client-side Firebase initialization

#### ⚠️ **High-Impact Files** (Major features break)
1. **`lib/hooks/useFirestore.ts`** - Data fetching for all UI components
2. **`lib/services/firebase-resume-service.ts`** - Resume processing pipeline
3. **`lib/hooks/useRealtimeFirestore.ts`** - Real-time data synchronization

### Authentication Chain
```
User Login → Firebase Client Auth → ID Token → Server Verification → Session Cookie
```

**Failure Points**:
1. **Client initialization** (`firebase/client.ts`) - API key issues
2. **Token verification** (`lib/middleware/authMiddleware.ts`) - gRPC SSL issues
3. **Session creation** - Admin SDK certificate problems

## File-by-File Analysis

### Frontend Layer (85 files)

#### Authentication Components
| File | Firebase Services | Usage Pattern | Risk Level |
|------|------------------|---------------|------------|
| `contexts/AuthContext.tsx` | Auth, onAuthStateChanged | Authentication state management | 🔴 **CRITICAL** |
| `components/AuthForm.tsx` | Auth, signInWithPopup | User sign-in/sign-up | 🔴 **HIGH** |
| `components/GoogleSignInButton.tsx` | Auth, GoogleAuthProvider | OAuth integration | 🟡 **MEDIUM** |
| `components/authenticated-layout.tsx` | AuthContext hook | Layout protection | 🔴 **HIGH** |

#### Data Components  
| File | Firebase Services | Usage Pattern | Risk Level |
|------|------------------|---------------|------------|
| `lib/hooks/useFirestore.ts` | Firestore queries | Data fetching | 🔴 **CRITICAL** |
| `lib/hooks/useRealtimeFirestore.ts` | Firestore onSnapshot | Real-time updates | 🔴 **HIGH** |
| `components/InterviewCardRealtime.tsx` | Real-time hooks | Live data display | 🟡 **MEDIUM** |

#### Storage Components
| File | Firebase Services | Usage Pattern | Risk Level |
|------|------------------|---------------|------------|
| `components/PdfUploadButton.tsx` | Storage, file upload | Resume uploads | 🟡 **MEDIUM** |
| `lib/services/firebase-resume-service.ts` | Admin Storage | File management | 🔴 **HIGH** |

### Backend Layer (35 files)

#### API Routes
| File | Firebase Services | Usage Pattern | Risk Level |
|------|------------------|---------------|------------|
| `app/api/auth/signin/route.ts` | Admin Auth verification | User sign-in API | 🔴 **CRITICAL** |
| `app/api/auth/signup/route.ts` | Admin Auth, Firestore | User creation API | 🔴 **CRITICAL** |
| `app/api/config/firebase/route.ts` | Environment config | Client configuration | 🔴 **HIGH** |

#### Azure Functions Integration
| File | Firebase Services | Usage Pattern | Risk Level |
|------|------------------|---------------|------------|
| `azure/shared/authMiddleware.js` | Admin SDK initialization | Cross-service auth | 🔴 **CRITICAL** |
| `azure/deleteUserData/index.js` | Admin Auth, Admin SDK | GDPR compliance | 🟡 **MEDIUM** |

### Shared Library Layer (25 files)

#### Core Services
| File | Firebase Services | Usage Pattern | Risk Level |
|------|------------------|---------------|------------|
| `firebase/admin.ts` | Full Admin SDK | Server initialization | 🔴 **CRITICAL** |
| `firebase/client.ts` | Client SDK | Frontend initialization | 🔴 **CRITICAL** |
| `lib/services/firebase-verification.ts` | REST API fallback | Auth resilience | 🔴 **HIGH** |

## Configuration Dependencies

### Environment Variables Required
```bash
# Firebase Admin SDK
FIREBASE_PROJECT_ID=prepbettr
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-***@prepbettr.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n***\n-----END PRIVATE KEY-----\n"

# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=***
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=prepbettr.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=prepbettr
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=prepbettr.firebasestorage.app

# Compatibility
GRPC_VERBOSITY=ERROR
NODE_OPTIONS="--no-warnings --openssl-legacy-provider"
FIRESTORE_PREFER_REST="true"
```

### Firebase Configuration Files
- `firebase.json` - Firebase project configuration
- `firestore.rules` - Database security rules
- `firestore.indexes.json` - Database indexes
- `.firebaserc` - Project aliases

## Testing Dependencies

### Firebase Emulator Usage
```javascript
// Test setup files
'tests/global-setup.ts' - Starts Firebase emulators
'tests/firestore-rules.test.ts' - Security rules testing
'tests/integration/staging-functions.spec.ts' - Integration testing
```

### Emulator Configuration
```bash
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
```

## Migration Considerations

### High-Risk Migration Areas
1. **Authentication System** - Deeply integrated across 65+ files
2. **Real-time Data** - Firestore onSnapshot in 15+ components
3. **Security Rules** - Custom Firestore rules for data access
4. **File Storage** - Resume processing pipeline dependencies

### Potential Breaking Changes
- Token format changes (Firebase JWT → alternative)
- Query syntax differences (Firestore → alternative DB)
- Real-time subscription patterns
- File storage URL formats

## Next Steps

### Immediate Actions
1. **Stabilize gRPC Issues** - Ensure REST API fallback works reliably
2. **Authentication Audit** - Review all 4 authentication implementations
3. **Storage Abstraction** - Create unified interface for Firebase/Azure storage

### Cross-Reference
- See [Azure Dependencies](azure-dependencies.md) for Azure service analysis
- See [Shared Functionality](shared-functionality.md) for duplication analysis  
- See [Risk Assessment](risk-assessment.md) for migration planning
