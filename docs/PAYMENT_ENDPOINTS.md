# Payment Flow API Endpoints

This document describes the payment flow API endpoints implemented for PrepBettr using the Dodo SDK.

## Overview

Two main endpoints have been implemented to handle subscription payments and customer management:

1. **POST** `/api/payments/create-checkout` - Creates a checkout session for subscription payments
2. **GET** `/api/payments/portal-link` - Generates customer portal links for subscription management

## API Endpoints

### POST `/api/payments/create-checkout`

Creates a subscription checkout session using Dodo Payments.

#### Request Body
```json
{
  "uid": "user_firebase_id"
}
```

#### Response
```json
{
  "checkoutUrl": "https://checkout.dodopayments.com/...",
  "subscriptionId": "sub_xxxxx"
}
```

#### Functionality
- Authenticates the user using Firebase session
- Creates or retrieves existing Dodo customer
- Stores `dodoCustomerId` in user subscription record on first run  
- Creates a subscription with payment link
- Includes metadata: `uid`, `plan: "premium"`, `source: "checkout_flow"`
- Uses success/cancel URLs for redirect handling

#### Environment Variables Required
- `DODO_PAYMENTS_API_KEY` - Dodo Payments API key
- `DODO_PREMIUM_PRODUCT_ID` - Product ID for premium subscription
- `NEXTAUTH_URL` - Base URL for success/cancel redirects

### GET `/api/payments/portal-link`

Generates customer portal link for subscription management and cancellation.

#### Request
No body required - uses authenticated user session.

#### Response  
```json
{
  "portalUrl": "https://portal.dodopayments.com/..."
}
```

#### Functionality
- Authenticates the user using Firebase session
- Creates or retrieves existing Dodo customer if needed
- Stores `dodoCustomerId` in user subscription record on first run
- Creates customer portal session link
- Portal allows customers to manage/cancel subscriptions

#### Environment Variables Required
- `DODO_PAYMENTS_API_KEY` - Dodo Payments API key
- `NEXTAUTH_URL` - Return URL after portal management

## Implementation Details

### Authentication
Both endpoints use Firebase authentication via `getCurrentUser()` from `@/lib/actions/auth.action`.

### Customer Management
- New customers are automatically created in Dodo if they don't exist
- `dodoCustomerId` is stored in Firestore via `subscriptionService`  
- Customer creation uses user's email and name from Firebase auth

### Error Handling
Both endpoints include comprehensive error handling for:
- Authentication failures (401)
- Missing parameters (400) 
- User ID mismatches (403)
- Dodo API failures (500)
- Configuration errors (500)

### Integration with Existing System
- Uses existing `subscriptionService` for customer ID storage
- Integrates with Firebase authentication system
- Follows existing API response patterns
- Compatible with webhook processing system

## Webhook Integration

These endpoints work with the existing webhook system:
- Subscription events are processed via `/api/webhooks/dodo/route.ts`
- Customer IDs stored by these endpoints are used in webhook processing
- Metadata includes `uid` for proper user association in webhooks

## Security Features

- Firebase session-based authentication
- User ID verification between request and session
- Secure environment variable handling
- Comprehensive error logging without exposing sensitive data

## Usage Example

### Frontend Integration

```javascript
// Create checkout
const response = await fetch('/api/payments/create-checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ uid: user.id })
});
const { checkoutUrl } = await response.json();
window.location.href = checkoutUrl;

// Get portal link  
const portalResponse = await fetch('/api/payments/portal-link');
const { portalUrl } = await portalResponse.json();
window.open(portalUrl, '_blank');
```
