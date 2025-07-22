# Real-Time Usage Counter Service

This document outlines the implementation of the real-time usage counter service using Firebase Firestore listeners, optimistic client-side updates, and Cloud Functions for automatic counter resets.

## Architecture Overview

The usage counter service consists of three main components:

1. **React Context (`UsageContext`)** - Provides real-time Firestore listeners and client-side state management
2. **Optimistic Updates** - Immediate UI feedback without waiting for server round-trips
3. **Cloud Function** - Automatic counter resets when user plan changes

## Components

### 1. UsageContext (`contexts/UsageContext.tsx`)

The main React context that manages real-time usage counter state:

```typescript
import { useUsage } from "@/contexts/UsageContext";

function MyComponent() {
  const { usage, loading, error, canUseFeature, getRemainingCount } = useUsage();
  
  if (canUseFeature('interviews')) {
    // User can perform an interview
  }
  
  const remaining = getRemainingCount('resumeTailor');
  // Get remaining count for resume tailor
}
```

**Features:**
- Real-time Firestore listeners for usage counters
- Optimistic client-side updates
- Automatic error handling and state management
- Provides helper functions for checking feature availability

### 2. UsageActions Hook (`hooks/useUsageActions.ts`)

Provides server-side integration and usage actions:

```typescript
import { useUsageActions } from "@/hooks/useUsageActions";

function MyComponent() {
  const { 
    checkUsage, 
    incrementUsage, 
    incrementUsageOptimistic,
    canUseFeature,
    isCheckingUsage 
  } = useUsageActions();

  const handleFeatureUse = async () => {
    // Check if user can use feature
    if (!canUseFeature('interviews')) {
      return;
    }

    // Optimistically increment for immediate UI feedback
    incrementUsageOptimistic('interviews');

    try {
      // Perform your feature action
      await performInterview();

      // Sync with server (optional - runs in background)
      await incrementUsage('interviews');
    } catch (error) {
      // Handle error
    }
  };
}
```

### 3. UsageDisplay Component (`components/UsageDisplay.tsx`)

A reusable component for displaying usage counters:

```typescript
import { UsageDisplay } from "@/components/UsageDisplay";

// Show all usage counters in detailed view
<UsageDisplay variant="detailed" />

// Show specific feature in compact view
<UsageDisplay feature="interviews" variant="compact" />

// Show all features compactly
<UsageDisplay variant="compact" />
```

### 4. Cloud Function (`functions/index.js`)

Automatically resets usage counters when user plan changes:

```javascript
// Triggered when user document is updated
exports.onUserPlanChange = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    // Detects plan changes and resets counters accordingly
  });
```

## Usage Patterns

### Basic Feature Usage with Optimistic Updates

```typescript
import { useUsageActions } from "@/hooks/useUsageActions";

function InterviewComponent() {
  const { incrementUsageOptimistic, incrementUsage, canUseFeature } = useUsageActions();

  const startInterview = async () => {
    // Check availability first
    if (!canUseFeature('interviews')) {
      toast.error("You've reached your interview limit");
      return;
    }

    // Optimistic update for immediate UI feedback
    incrementUsageOptimistic('interviews');

    try {
      // Perform the actual interview creation
      await createInterview();

      // Sync with server in background
      incrementUsage('interviews').catch(console.error);
    } catch (error) {
      // Handle error - optimistic update will be corrected by real-time listener
      toast.error("Failed to start interview");
    }
  };
}
```

### Displaying Real-Time Usage

```typescript
import { UsageDisplay } from "@/components/UsageDisplay";

function Dashboard() {
  return (
    <div>
      <h2>Your Usage</h2>
      <UsageDisplay variant="detailed" />
    </div>
  );
}
```

### Feature-Specific Usage Display

```typescript
import { UsageDisplay } from "@/components/UsageDisplay";

function ResumeSection() {
  return (
    <div>
      <h3>Resume Tailor</h3>
      <UsageDisplay feature="resumeTailor" variant="compact" />
      {/* Your resume components */}
    </div>
  );
}
```

## Data Structure

### Firestore Structure

```
usage/
  {userId}/
    counters/
      interviews: {
        count: 2,
        limit: 3,
        updatedAt: timestamp
      }
      resumeTailor: {
        count: 1,
        limit: 2,
        updatedAt: timestamp
      }
      autoApply: {
        count: 0,
        limit: 1,
        updatedAt: timestamp
      }
```

### Plan Limits

```typescript
const DEFAULT_USAGE_LIMITS = {
  free: {
    interviews: { count: 0, limit: 3 },
    resumeTailor: { count: 0, limit: 2 },
    autoApply: { count: 0, limit: 1 },
  },
  premium: {
    interviews: { count: 0, limit: -1 }, // -1 = unlimited
    resumeTailor: { count: 0, limit: -1 },
    autoApply: { count: 0, limit: -1 },
  },
};
```

## Setup Instructions

### 1. Install Dependencies

The service uses existing Firebase dependencies:
- `firebase` (client SDK)
- `firebase-admin` (server SDK)
- `firebase-functions` (Cloud Functions)

### 2. Add Context Providers

Update your main layout to include the UsageProvider:

```typescript
// app/layout.tsx
import { AuthProvider } from "@/contexts/AuthContext";
import { UsageProvider } from "@/contexts/UsageContext";

export default function RootLayout({ children }) {
  return (
    <AuthProvider>
      <UsageProvider>
        {children}
      </UsageProvider>
    </AuthProvider>
  );
}
```

### 3. Deploy Cloud Function

Deploy the Cloud Function for automatic counter resets:

```bash
firebase deploy --only functions
```

### 4. Initialize Usage Counters

Usage counters are automatically initialized when users are created through the existing `subscriptionService.initializeUserSubscription()` method.

## API Endpoints

The service integrates with existing API endpoints:

- `POST /api/usage/check` - Check if user can use a feature
- `POST /api/usage/increment` - Increment usage counter

## Benefits

1. **Real-Time Updates**: Users see live usage updates across all browser tabs/sessions
2. **Optimistic UI**: Immediate feedback without waiting for server responses
3. **Automatic Resets**: Plan upgrades/downgrades automatically reset counters
4. **Error Resilience**: Real-time listeners ensure consistency even if optimistic updates fail
5. **Performance**: Reduces API calls through client-side caching and optimistic updates

## Error Handling

The service includes comprehensive error handling:

- **Network errors**: Graceful fallbacks and user notifications
- **Permission errors**: Clear messaging about usage limits
- **Sync failures**: Automatic correction through real-time listeners
- **Plan changes**: Automatic counter resets via Cloud Functions

## Performance Considerations

- **Real-time listeners**: Only active for authenticated users
- **Optimistic updates**: Immediate UI feedback reduces perceived latency
- **Background sync**: Server synchronization happens asynchronously
- **Efficient queries**: Firestore listeners are scoped to user's counters only

## Future Enhancements

1. **Usage Analytics**: Track usage patterns for insights
2. **Quota Warnings**: Proactive notifications when approaching limits
3. **Usage History**: Track usage over time for analytics
4. **Custom Limits**: Per-user custom limits for enterprise plans
