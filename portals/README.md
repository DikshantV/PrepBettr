# LinkedIn & Wellfound OAuth Integration

This directory contains OAuth integration implementations for LinkedIn and Wellfound (AngelList) job portals. The integration provides secure token management via Azure Key Vault, rate limiting per platform guidelines, and automated token refresh.

## Architecture Overview

### Components

1. **Azure Token Service** (`lib/services/azure-token-service.ts`)
   - Secure token storage in Azure Key Vault
   - Token refresh management
   - Azure AD configuration storage

2. **Portal Wrappers**
   - `portals/linkedin.ts` - LinkedIn API integration
   - `portals/wellfound.ts` - Wellfound (AngelList) API integration

3. **Azure Functions Timer** (`azure/TokenRefreshTimer/`)
   - Automatic token refresh every 6 hours
   - Prevents token expiration

4. **API Routes**
   - `/api/oauth/authorize` - Generate OAuth URLs
   - `/api/oauth/callback` - Handle OAuth callbacks
   - `/api/portal-config` - Manage portal configurations

## Setup Instructions

### 1. Azure AD App Registration

#### For LinkedIn:
1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Create a new app
3. Configure OAuth settings:
   - **Redirect URI**: `https://yourdomain.com/api/oauth/callback?portal=linkedin`
   - **Scopes**: `r_liteprofile r_emailaddress w_member_social`
4. Note down the Client ID and Client Secret

#### For Wellfound (AngelList):
1. Go to [AngelList API](https://angel.co/api)
2. Create a new application
3. Configure OAuth settings:
   - **Redirect URI**: `https://yourdomain.com/api/oauth/callback?portal=wellfound`
   - **Scopes**: `read write`
4. Note down the Client ID and Client Secret

### 2. Azure Key Vault Setup

1. Create an Azure Key Vault if you don't have one
2. Ensure your application has the following permissions:
   - `Key Vault Secrets User` (for reading secrets)
   - `Key Vault Secrets Officer` (for writing secrets)
3. Update your `.env.local` with the Key Vault URI:
   ```
   AZURE_KEY_VAULT_URI=https://your-keyvault.vault.azure.net/
   ```

### 3. Configure Portal OAuth Settings

Use the portal configuration API to securely store OAuth settings:

```bash
# Configure LinkedIn
curl -X POST https://yourdomain.com/api/portal-config \
  -H "Content-Type: application/json" \
  -d '{
    "portal": "linkedin",
    "clientId": "your-linkedin-client-id",
    "clientSecret": "your-linkedin-client-secret",
    "redirectUri": "https://yourdomain.com/api/oauth/callback?portal=linkedin",
    "scopes": ["r_liteprofile", "r_emailaddress", "w_member_social"]
  }'

# Configure Wellfound
curl -X POST https://yourdomain.com/api/portal-config \
  -H "Content-Type: application/json" \
  -d '{
    "portal": "wellfound",
    "clientId": "your-wellfound-client-id",
    "clientSecret": "your-wellfound-client-secret",
    "redirectUri": "https://yourdomain.com/api/oauth/callback?portal=wellfound",
    "scopes": ["read", "write"]
  }'
```

### 4. Deploy Azure Functions Timer

1. Navigate to the `azure/` directory
2. Deploy the TokenRefreshTimer function:
   ```bash
   func azure functionapp publish your-function-app-name
   ```
3. Ensure the function app has access to your Key Vault

## Usage

### 1. User Authentication Flow

```typescript
// Generate OAuth URL
const response = await fetch('/api/oauth/authorize?portal=linkedin&userId=user123');
const { authUrl } = await response.json();

// Redirect user to authUrl
window.location.href = authUrl;

// User will be redirected back to your callback URL after authorization
```

### 2. Job Search Integration

```typescript
import { getLinkedInPortal } from '../portals/linkedin';
import { getWellfoundPortal } from '../portals/wellfound';

// Search LinkedIn jobs
const linkedinPortal = getLinkedInPortal();
await linkedinPortal.initialize();
const linkedinJobs = await linkedinPortal.searchJobs(userId, filters);

// Search Wellfound jobs
const wellfoundPortal = getWellfoundPortal();
await wellfoundPortal.initialize();
const wellfoundJobs = await wellfoundPortal.searchJobs(userId, filters);
```

### 3. Job Application

```typescript
// Apply to LinkedIn job
const result = await linkedinPortal.applyToJob(userId, jobId, {
  coverLetter: 'Custom cover letter',
  resume: 'resume-url'
});

// Apply to Wellfound job
const result = await wellfoundPortal.applyToJob(userId, jobId, {
  message: 'Custom application message',
  resume_url: 'resume-url'
});
```

## Rate Limiting

Each portal has built-in rate limiting using the Bottleneck library:

- **LinkedIn**: 400 requests per day, 2 seconds between requests
- **Wellfound**: 1000 requests per hour, 3.6 seconds between requests

## Token Management

### Automatic Refresh
The Azure Functions Timer automatically refreshes tokens every 6 hours to prevent expiration.

### Manual Token Management
```typescript
import { getAzureTokenService } from '../lib/services/azure-token-service';

const tokenService = getAzureTokenService();

// Get tokens
const tokens = await tokenService.getTokens('linkedin', userId);

// Check if refresh needed
if (tokenService.needsRefresh(tokens)) {
  const refreshedTokens = await tokenService.refreshTokens('linkedin', userId, tokens.refreshToken, config);
}

// Delete tokens (logout)
await tokenService.deleteTokens('linkedin', userId);
```

## API Endpoints

### GET /api/oauth/authorize
Generate OAuth authorization URL

**Parameters:**
- `portal`: 'linkedin' | 'wellfound'
- `userId`: User identifier
- `state`: Optional state parameter

### GET/POST /api/oauth/callback
Handle OAuth callback and exchange code for tokens

### POST /api/portal-config
Store portal OAuth configuration

### GET /api/portal-config
Retrieve portal configuration (without secrets)

## Error Handling

The integration includes comprehensive error handling:

- Connection failures fall back to mock data
- Rate limit exceeded errors are properly handled
- Token refresh failures are logged and reported
- Network errors are retried with exponential backoff

## Security Considerations

1. **Secret Storage**: All sensitive data stored in Azure Key Vault
2. **Token Encryption**: Tokens encrypted at rest in Key Vault
3. **Rate Limiting**: Prevents API abuse and account suspension
4. **Scope Limitation**: Request only necessary OAuth scopes
5. **Token Rotation**: Regular automatic token refresh

## Troubleshooting

### Common Issues

1. **"Portal not initialized" error**
   - Ensure OAuth configuration is stored via `/api/portal-config`
   - Check Azure Key Vault permissions

2. **Rate limit exceeded**
   - Review rate limiting configuration
   - Implement request queuing in your application

3. **Token refresh failures**
   - Check Azure Functions Timer logs
   - Verify OAuth app settings in portal dashboards

4. **Connection failures**
   - User needs to re-authenticate via OAuth flow
   - Check token expiration dates

### Logs and Monitoring

- Azure Functions logs for token refresh operations
- Application Insights for API performance
- Key Vault access logs for security monitoring

## Development vs Production

### Development
- Use test OAuth applications
- Point redirect URIs to localhost
- Enable verbose logging

### Production
- Use production OAuth applications
- Implement proper error monitoring
- Set up alerts for token refresh failures
- Regular backup of Key Vault secrets

## Contributing

When adding new portal integrations:

1. Follow the same pattern as LinkedIn/Wellfound
2. Implement rate limiting per portal guidelines
3. Add comprehensive error handling
4. Update type definitions in `types/auto-apply.ts`
5. Add configuration management
6. Include tests for critical paths
