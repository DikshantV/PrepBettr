# Firebase Admin SDK Configuration

This document describes how to configure Firebase Admin SDK for the PrepBettr application, including service account management, Azure Key Vault integration, and security best practices.

## Overview

PrepBettr uses Firebase Admin SDK for:
- **Authentication**: Verifying Firebase ID tokens on the server-side
- **Firestore**: Database operations for user profiles and application data
- **Storage**: File upload and management (if using Firebase Storage)

The Firebase Admin SDK requires service account credentials to authenticate with Firebase services from your server-side code.

## Service Account Setup

### 1. Generate Service Account Key

1. **Access Firebase Console**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project: **prepbettr**

2. **Navigate to Service Accounts**
   - Click **⚙️ Project Settings** → **Service Accounts** tab
   - Click **"Generate new private key"**

3. **Download Credentials**
   - Save the JSON file securely (e.g., `~/secrets/prepbettr-admin.json`)
   - **NEVER commit this file to version control**

4. **Set Calendar Reminder**
   - Add a calendar reminder to rotate this key every 90 days
   - This is a security best practice for service account keys

### 2. Required Roles

Ensure your service account has these Firebase roles:
- **Firebase Admin SDK Administrator** (recommended)
- Or minimum required roles:
  - **Firebase Authentication Admin**
  - **Cloud Datastore User** (for Firestore)
  - **Storage Object Admin** (if using Firebase Storage)

## Azure Key Vault Integration

PrepBettr stores Firebase credentials securely in Azure Key Vault for production and staging environments.

### Secret Names Mapping

| Firebase Credential | Azure Key Vault Secret Name |
|-------------------|----------------------------|
| `project_id`      | `firebase-project-id`      |
| `client_email`    | `firebase-client-email`    |
| `private_key`     | `firebase-private-key`     |

### Adding Secrets to Azure Key Vault

```bash
# Set project ID
az keyvault secret set --vault-name "prepbettr-keyvault-083" \
  --name "firebase-project-id" \
  --value "prepbettr"

# Set client email
az keyvault secret set --vault-name "prepbettr-keyvault-083" \
  --name "firebase-client-email" \
  --value "firebase-adminsdk-fbsvc@prepbettr.iam.gserviceaccount.com"

# Set private key (with proper escaping)
az keyvault secret set --vault-name "prepbettr-keyvault-083" \
  --name "firebase-private-key" \
  --value "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
```

### Access Control

Ensure your deployment service principal has these permissions on the Key Vault:
- **Key Vault Secrets User** role
- **Get** permission on secrets
- Access to the specific secrets listed above

## Environment Configuration

### Local Development (.env.local)

```bash
# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=prepbettr
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@prepbettr.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
```

**Important Notes:**
- Replace literal newlines in the private key with `\n` characters
- Keep this file in `.gitignore` (never commit secrets)
- Restart your dev server after adding these variables

### Production/Staging

Production environments automatically fetch credentials from Azure Key Vault using the configuration in `lib/azure-config.ts`.

## Code Integration

### Firebase Admin Initialization

The Firebase Admin SDK is initialized in `lib/firebase/admin.ts` with this priority order:

1. **Azure Key Vault** (production/staging)
2. **Environment variables** (local development)
3. **Fallback to project ID only** (limited functionality)

### Key Code Locations

- **Admin SDK**: `lib/firebase/admin.ts`
- **Azure Config**: `lib/azure-config.ts`
- **Unified Auth**: `lib/shared/auth/core.ts`
- **API Routes**: `app/api/auth/signin/route.ts`

## Security Best Practices

### Service Account Key Rotation

1. **Generate new service account key** in Firebase Console
2. **Update Azure Key Vault secrets** with new credentials
3. **Test in staging environment** before production deployment
4. **Deploy to production** via CI/CD pipeline
5. **Revoke old key** in Firebase Console after successful deployment

### Access Control

- **Principle of Least Privilege**: Only grant required Firebase roles
- **Key Vault Access**: Limit to deployment service principals only
- **Environment Separation**: Use different service accounts for dev/staging/prod

### Monitoring

- **Enable audit logs** in Firebase Console
- **Monitor key usage** in Firebase IAM & Admin
- **Set up alerts** for authentication failures
- **Review service account permissions** quarterly

## Troubleshooting

### Common Issues

1. **"Could not load the default credentials"**
   - Check if service account credentials are properly configured
   - Verify Azure Key Vault access permissions
   - Confirm environment variables are set correctly

2. **"Firebase project not found"**
   - Verify `FIREBASE_PROJECT_ID` matches your Firebase project
   - Check service account has access to the project

3. **"Invalid service account"**
   - Ensure service account key is not expired
   - Verify the key has not been revoked
   - Check the private key format (newlines should be `\n`)

### Debug Commands

```bash
# Test Azure Key Vault access
az keyvault secret show --vault-name "prepbettr-keyvault-083" --name "firebase-project-id"

# Check Firebase project access
firebase projects:list

# Verify service account
firebase auth:export --project prepbettr users.json
```

## Deployment Checklist

- [ ] Service account key generated and downloaded
- [ ] Azure Key Vault secrets updated
- [ ] Local `.env.local` configured for development
- [ ] CI/CD pipeline has Key Vault access
- [ ] Service account permissions reviewed
- [ ] Key rotation reminder set (90 days)
- [ ] Old keys revoked after successful deployment

## Emergency Procedures

### If Service Account Key is Compromised

1. **Immediately revoke** the compromised key in Firebase Console
2. **Generate new service account key**
3. **Update Azure Key Vault** with new credentials
4. **Deploy emergency fix** to all environments
5. **Review access logs** for suspicious activity
6. **Update team** and document incident

### Key Vault Access Issues

1. **Check service principal permissions**
2. **Verify Key Vault firewall rules**
3. **Test with Azure CLI**: `az keyvault secret list --vault-name prepbettr-keyvault-083`
4. **Fallback to environment variables** if needed
5. **Contact Azure support** for persistent issues

## References

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Azure Key Vault Documentation](https://docs.microsoft.com/en-us/azure/key-vault/)
- [Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices-for-service-accounts)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

---

**Last Updated**: September 2025  
**Maintainer**: PrepBettr Platform Team  
**Review Schedule**: Quarterly