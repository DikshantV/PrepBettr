# Server-Side Verification Integration Guide

This document explains how to use the implemented server-side verification system in your PrepBettr application.

## Overview

We've implemented a comprehensive server-side verification system that provides multiple layers of security:

1. **Firebase Admin SDK Verification** (Primary)
2. **Firebase REST API Verification** (Fallback)
3. **Cloud Functions Verification** (Optional)
4. **Token Claim Validation**
5. **Session Cookie Management**

## Features

### ✅ Implemented Components

- **Firebase Verification Service** (`/lib/services/firebase-verification.ts`)
- **Cloud Functions Service** (`/lib/services/cloud-functions-verification.ts`)
- **Updated Authentication Actions** (`/lib/actions/auth.action.ts`)
- **Protected API Routes** (`/app/api/protected/`)
- **Authentication Middleware** (`/middleware.ts`)
- **Cloud Functions** (`/functions/`)

### 🔒 Security Features

- Server-side token verification
- Token claim validation (expiry, issuer, audience)
- Automatic fallback mechanisms
- Session cookie management
- Protected route middleware
- Permission-based access control

## How It Works

### 1. Authentication Flow

```mermaid
graph TD
    A[Client Login] --> B[Firebase Auth]
    B --> C[ID Token]
    C --> D[Server Verification]
    D --> E{Admin SDK Available?}
    E -->|Yes| F[Admin SDK Verify]
    E -->|No| G[REST API Verify]
    F --> H[Token Validation]
    G --> H[Token Validation]
    H --> I[Set Session Cookie]
    I --> J[Access Granted]
```

### 2. Verification Methods

#### Primary: Firebase Admin SDK
```typescript
const verificationResult = await firebaseVerification.verifyIdToken(idToken);
```

#### Fallback: Firebase REST API
- Automatically used if Admin SDK fails
- Uses Firebase Identity Toolkit API
- Converts response to Admin SDK format

#### Optional: Cloud Functions
```typescript
const cloudResult = await cloudFunctionsVerification.verifyTokenWithCloudFunction(idToken);
```

## Usage Examples

### 1. In API Routes

```typescript
import { firebaseVerification } from '@/lib/services/firebase-verification';

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value;
  
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
  
  if (!verificationResult.success) {
    return NextResponse.json({ 
      error: 'Invalid session',
      details: verificationResult.error 
    }, { status: 401 });
  }

  const userId = verificationResult.decodedToken.uid;
  // Handle authenticated request...
}
```

### 2. In Server Actions

```typescript
import { firebaseVerification } from '@/lib/services/firebase-verification';

export async function protectedAction(formData: FormData) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  
  if (!sessionCookie) {
    throw new Error('Authentication required');
  }

  const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
  
  if (!verificationResult.success) {
    throw new Error('Invalid session');
  }

  // Handle authenticated action...
}
```

### 3. Using Cloud Functions

First, deploy the Cloud Functions:

```bash
cd functions
npm install
firebase deploy --only functions
```

Then use in your application:

```typescript
import { cloudFunctionsVerification } from '@/lib/services/cloud-functions-verification';

const result = await cloudFunctionsVerification.verifyTokenWithCloudFunction(idToken);
```

## Configuration

### Environment Variables

Add these to your `.env.local`:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
NEXT_PUBLIC_FIREBASE_CLIENT_KEY=your-web-api-key

# Optional: Cloud Functions URL
FIREBASE_FUNCTIONS_URL=https://us-central1-your-project.cloudfunctions.net
```

### Middleware Configuration

Update `middleware.ts` to define your protected routes:

```typescript
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/admin',
  '/api/protected',
];
```

## Testing

### 1. Test Server-Side Verification

```bash
# Test the verification service
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"idToken": "your-firebase-id-token"}'
```

### 2. Test Protected Routes

```bash
# Without authentication (should redirect/fail)
curl http://localhost:3000/api/protected/user-profile

# With session cookie
curl http://localhost:3000/api/protected/user-profile \
  -H "Cookie: session=your-session-token"
```

### 3. Test Cloud Functions

```bash
# Deploy and test Cloud Functions
cd functions
firebase deploy --only functions
firebase functions:log
```

## Troubleshooting

### Common Issues

1. **SSL/Certificate Issues with Firebase Admin**
   - The system automatically falls back to REST API
   - Check logs for "Falling back to REST API verification"

2. **Token Validation Failures**
   - Ensure tokens are not expired
   - Check token issuer and audience match your project
   - Verify environment variables are correct

3. **Middleware Redirects**
   - Check protected routes configuration
   - Verify session cookies are being set correctly
   - Test with browser dev tools

### Debug Logging

Enable detailed logging:

```typescript
// In your verification calls
const verificationResult = await firebaseVerification.verifyIdToken(idToken);
console.log('Verification method used:', verificationResult.method);
console.log('Verification success:', verificationResult.success);
```

## Security Considerations

### Best Practices

1. **Always verify tokens server-side** - Never trust client-side verification alone
2. **Use HTTPS in production** - Set `secure: true` for cookies in production
3. **Validate token claims** - Check expiry, issuer, and audience
4. **Handle errors gracefully** - Don't expose sensitive error details to clients
5. **Use session cookies** - Prefer Firebase session cookies over ID tokens when possible

### Token Lifecycle

- **ID Tokens**: Short-lived (1 hour), verified on each request
- **Session Cookies**: Longer-lived (configurable), created server-side
- **Automatic Refresh**: Client should refresh tokens before expiry

## Migration from Current System

### Step 1: Update Authentication
Replace your current token verification with:

```typescript
// Old
const decodedToken = decodeFirebaseToken(idToken);

// New
const verificationResult = await firebaseVerification.verifyIdToken(idToken);
const decodedToken = verificationResult.decodedToken;
```

### Step 2: Add Middleware Protection
The middleware will automatically protect routes defined in `protectedRoutes`.

### Step 3: Update API Routes
Use the new verification service in your API routes for proper server-side validation.

## Performance Considerations

- **Caching**: The verification service caches results when possible
- **Fallback Strategy**: REST API fallback adds ~100-200ms latency
- **Cloud Functions**: Additional network hop, use for specialized validation
- **Session Cookies**: More efficient than verifying ID tokens on each request

## Next Steps

1. **Deploy Cloud Functions** (optional but recommended)
2. **Update all API routes** to use new verification
3. **Test thoroughly** with different token states
4. **Monitor logs** for fallback usage and errors
5. **Set up alerts** for authentication failures

## Support

If you encounter issues:

1. Check the console logs for detailed error messages
2. Verify your Firebase project configuration
3. Test with Firebase CLI tools
4. Review the verification method being used in logs

For questions about the implementation, refer to the source code in `/lib/services/` or create an issue in the repository.
