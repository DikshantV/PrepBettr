# AuthContext Usage Guide

The `useAuth` context provides a clean way for client components to access the current user's authentication state without making additional API calls. The user data is already verified and serialized by server components and passed down through React context.

## Basic Usage

```tsx
"use client";

import { useAuth } from "@/contexts/AuthContext";

export function MyComponent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <div>Please sign in</div>;
  }
  
  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      <p>Email: {user.email}</p>
    </div>
  );
}
```

## Context Properties

- `user: User | null` - The current user object with id, name, email, and optional image
- `isAuthenticated: boolean` - Whether the user is currently authenticated
- `isLoading: boolean` - Whether the authentication state is still being determined

## Architecture

1. **Server Components**: Use `getCurrentUser()` from `@/lib/actions/auth.action` to get verified user data
2. **Layout Wrapper**: The dashboard layout wraps all content with `<AuthProvider>` and passes the server-verified user
3. **Client Components**: Use `useAuth()` hook to access user state without additional network requests

## Key Benefits

- **No Extra API Calls**: User data is already verified server-side and serialized through props
- **Consistent State**: All client components share the same user state
- **Type Safety**: Full TypeScript support with proper User interface
- **Error Handling**: Built-in error boundaries for missing provider usage

## Example Components

### User Profile Display
```tsx
import { useAuth } from "@/contexts/AuthContext";

export function UserProfile() {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) return null;
  
  return (
    <div className="flex items-center space-x-2">
      {user.image && <img src={user.image} alt={user.name} />}
      <span>{user.name}</span>
    </div>
  );
}
```

### Conditional Rendering
```tsx
import { useAuth } from "@/contexts/AuthContext";

export function ConditionalContent() {
  const { isAuthenticated, user } = useAuth();
  
  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome back, {user.name}!</p>
      ) : (
        <p>Please sign in to continue</p>
      )}
    </div>
  );
}
```

### User-Specific Actions
```tsx
import { useAuth } from "@/contexts/AuthContext";

export function InterviewActions() {
  const { user, isAuthenticated } = useAuth();
  
  const handleStartInterview = () => {
    if (isAuthenticated && user) {
      // User ID is available for API calls
      startInterview(user.id);
    }
  };
  
  return (
    <button 
      onClick={handleStartInterview}
      disabled={!isAuthenticated}
    >
      Start Interview
    </button>
  );
}
```

## Setup

The context is automatically set up in the dashboard layout (`/app/dashboard/layout.tsx`). All pages within the dashboard automatically have access to the authenticated user context.

No additional setup is required for individual components - just import and use the `useAuth` hook.
