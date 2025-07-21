This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Authentication Flow

### Current Flow
- **Server-side**: The server initially verifies the cookie received from the client.
- **Middleware Processing**: After cookie verification, the request is processed through a series of middleware.
- **Layout Application**: Finally, the layout is applied based on the authenticated status.

### SSL/gRPC Compatibility Issue

**Problem**: Firebase Admin SDK has compatibility issues with Node.js 18+ and OpenSSL 3.x, causing the error:
```
2 UNKNOWN: Getting metadata from plugin failed with error: error:1E08010C:DECODER routines::unsupported
```

**Current Solution**: The authentication system uses a robust fallback mechanism:
1. **Primary**: Attempts Firebase Admin SDK verification (fails due to SSL issue)
2. **Fallback**: Uses Firebase REST API verification (maintains security)
3. **Validation**: Performs additional token claims validation

**Implementation**: 
- `lib/services/firebase-verification.ts` handles the fallback logic
- Authentication remains secure through REST API verification
- Session cookies created when possible, otherwise ID tokens are used

### Attempted Fixes

✅ **Environment Variables**:
```bash
NODE_OPTIONS="--openssl-legacy-provider"
GRPC_SSL_CIPHER_SUITES="ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384"
GRPC_VERBOSITY="ERROR"
FIRESTORE_PREFER_REST="true"
```

✅ **Node.js Version**: Updated to v20.19.4 (recommended)

✅ **gRPC Configuration**: Set environment variables to prefer REST transport

❌ **Still Failing**: The OpenSSL/gRPC issue persists in the current Firebase Admin SDK version

### Future Resolution

**When fixed**: Once Google/Firebase resolves the OpenSSL 3.x compatibility:
1. Remove the fallback logic in `firebase-verification.ts`
2. Restore direct Firebase Admin SDK usage
3. Enable full session cookie functionality

**Alternative Solutions**:
- Wait for Firebase Admin SDK update
- Use Docker with older OpenSSL version
- Downgrade to Node.js 16 (not recommended)

**Current Status**: ✅ **Fully Functional** - Authentication works reliably with REST API fallback

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
