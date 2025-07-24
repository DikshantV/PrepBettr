# Firestore Subscription & Usage Schema Migration

This document outlines the Firestore schema migration for implementing subscriptions and usage tracking in PrepBettr.

## Overview

The migration adds subscription management and usage tracking capabilities to the existing Firestore database, including:

1. Extended user collection with subscription fields
2. Usage counters sub-collections for tracking feature usage
3. Subscription events logging for webhook processing
4. DodoPayments integration for subscription management

## Schema Changes

### 1. Users Collection Extensions

Each user document now includes:

```typescript
interface ExtendedUser {
  // Existing fields
  uid: string;
  email: string;
  name: string;
  // ... other profile fields

  // New subscription fields
  plan: 'free' | 'premium';
  planStatus: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
  currentPeriodEnd: Date | null;
  dodoCustomerId: string | null;
  dodoSubscriptionId: string | null;
}
```

### 2. Usage Collection Structure

```
usage/
  {userId}/
    counters/
      interviews/
        count: number
        limit: number
        updatedAt: Date
      resumeTailor/
        count: number
        limit: number
        updatedAt: Date
      autoApply/
        count: number
        limit: number
        updatedAt: Date
```

### 3. Subscription Events Collection

```
subscription_events/
  {eventId}/
    userId: string
    eventType: string
    timestamp: Date
    rawWebhookData: object
    parsedData: object
    processed: boolean
    error?: string
```

## Default Usage Limits

### Free Plan
- Interviews: 3
- Resume Tailor: 2
- Auto Apply: 1

### Premium Plan
- All features: Unlimited (-1)

## Migration Process

### Option 1: Next.js API Route
Run migration via HTTP request:
```bash
curl -X POST http://localhost:3000/api/subscription/migrate
```

### Option 2: Standalone Script
Run migration directly with Node.js:
```bash
# Set environment variables
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_CLIENT_EMAIL="your-client-email"  
export FIREBASE_PRIVATE_KEY="your-private-key"

# Run migration
node scripts/migrate-users.js
```

## API Endpoints

### Check Usage
`POST /api/usage/check`
```json
{
  "feature": "interviews" | "resumeTailor" | "autoApply"
}
```

### Increment Usage
`POST /api/usage/increment`
```json
{
  "feature": "interviews" | "resumeTailor" | "autoApply"
}
```

## Webhook Integration

The DodoPayments webhook handler processes:
- `payment_intent.succeeded` - Activates subscription
- `payment_intent.payment_failed` - Logs failure
- `subscription.created/updated/canceled` - Updates subscription status

## Security Rules

Updated Firestore rules include:
- Users can read/write their own usage counters
- Subscription events are server-side only
- Existing user/interview/feedback rules preserved

## Files Modified/Created

### New Files
- `types/subscription.ts` - Type definitions
- `lib/services/subscription-service.ts` - Core subscription service
- `app/api/subscription/migrate/route.ts` - Migration API route
- `app/api/usage/check/route.ts` - Usage checking endpoint
- `app/api/usage/increment/route.ts` - Usage increment endpoint
- `scripts/migrate-users.js` - Standalone migration script

### Modified Files
- `app/api/webhooks/dodo/route.ts` - Enhanced webhook handling
- **Note**: `app/api/protected/user-profile/route.ts` has been moved to `__trash__/api/protected/user-profile/route.ts`
- `firestore.rules` - Added security rules for new collections
- `firestore.indexes.json` - Added indexes for new queries

## Usage in Components

### Check if user can use a feature
```typescript
import { subscriptionService } from '@/lib/services/subscription-service';

// Server-side
const canUse = await subscriptionService.canUseFeature(userId, 'interviews');

// Client-side via API
const response = await fetch('/api/usage/check', {
  method: 'POST',
  body: JSON.stringify({ feature: 'interviews' })
});
```

### Increment usage when feature is used
```typescript
// Server-side
const incremented = await subscriptionService.incrementUsage(userId, 'interviews');

// Client-side via API  
const response = await fetch('/api/usage/increment', {
  method: 'POST',
  body: JSON.stringify({ feature: 'interviews' })
});
```

## Testing Migration

1. Run the migration script
2. Verify user documents have new subscription fields
3. Check usage counter sub-collections are created
4. Test API endpoints with authenticated requests
5. Verify webhook processing with test events

## Monitoring

- Check subscription events collection for webhook processing logs
- Monitor usage patterns in usage counters
- Track subscription status changes in user documents

## Rollback Plan

If rollback is needed:
1. Revert Firestore rules to previous version
2. Remove new collections (usage, subscription_events)
3. Remove subscription fields from user documents
4. Revert API endpoints and webhook handlers
