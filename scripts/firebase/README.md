# Firebase Auto-Apply Collections Migration

This directory contains the migration scripts and documentation for setting up the Firestore collections required for the auto-apply job application feature.

## Overview

The auto-apply feature uses five main Firestore collections:

1. **`users`** - User profile information and preferences
2. **`autoApplySettings`** - Per-user automation settings and filters
3. **`jobListings`** - Discovered job postings from various portals
4. **`applications`** - Job applications and their status
5. **`automationLogs`** - Automation activity logs for debugging and analytics

## Quick Start

### 1. Prerequisites

Ensure you have the following environment variables set in `.env.local`:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 2. Run the Migration

```bash
# Seed the database with mock data
npm run seed-firestore

# Alternative command
npm run firestore:migrate
```

### 3. Deploy Security Rules and Indexes

```bash
# Deploy the updated security rules
firebase deploy --only firestore:rules

# Deploy the generated indexes
firebase deploy --only firestore:indexes
```

## Files Structure

```
scripts/firebase/
├── README.md                 # This file
├── collections-design.md     # Detailed collection schemas and design
├── mock-data.ts             # Mock data for seeding collections
└── migrate-seed-data.ts     # Migration script
```

## Collection Details

### Users Collection
- **Document ID**: Firebase Auth UID
- **Purpose**: Store user profiles, skills, experience, and preferences
- **Access**: Users can only read/write their own documents

### AutoApplySettings Collection
- **Document ID**: Firebase Auth UID  
- **Purpose**: Store automation settings, filters, and preferences per user
- **Access**: Users can only read/write their own settings

### JobListings Collection
- **Document ID**: Auto-generated or portal-specific ID
- **Purpose**: Shared job postings discovered from various job portals
- **Access**: Read-only for users, write access only for Cloud Functions

### Applications Collection  
- **Document ID**: Auto-generated
- **Purpose**: Track application status, materials, and follow-ups
- **Access**: Users can only access their own applications

### AutomationLogs Collection
- **Document ID**: Auto-generated
- **Purpose**: Log all automation activities for debugging and analytics
- **Access**: Read-only for users, write access only for Cloud Functions

## Security Rules

The migration updates `firestore.rules` with comprehensive security rules:

- **User Ownership**: All collections are user-scoped with proper access controls
- **Cloud Functions**: Service account role bypasses rules for automation
- **Shared Resources**: Job listings are discoverable but read-only for users
- **Data Protection**: Ensures users can only access their own data

## Migration Script Features

### Data Transformation
- Converts ISO date strings to Firestore Timestamps
- Handles nested objects and arrays properly
- Adds required fields for Firestore schema compatibility

### Error Handling
- Graceful error handling with detailed logging
- Continues migration even if individual documents fail
- Reports success/failure counts for each collection

### Validation
- Validates required environment variables
- Checks data integrity before writing
- Provides detailed console output for monitoring

## Generated Files

The migration script creates:

- **`firestore.indexes.json`**: Optimized composite indexes for query performance
- **Seeded Collections**: All collections populated with realistic mock data

## Mock Data

The migration includes comprehensive mock data:

- **2 Users**: John Doe (experienced full-stack dev) and Sarah Johnson (frontend dev)
- **Settings**: Different automation preferences for each user
- **4 Job Listings**: Various roles from different portals (LinkedIn, Indeed, AngelList)
- **3 Applications**: Different stages (applied, analyzing, ready to apply)
- **6+ Log Entries**: Various automation activities and error scenarios

## Performance Considerations

### Indexes
The script generates optimized indexes for common query patterns:
- User-scoped queries with status filtering
- Date range queries for applications and logs
- Job discovery queries with relevancy filtering

### Batch Operations
- Uses batch writes where applicable
- Implements proper error handling and rollback
- Optimizes for minimal read/write operations

## Development Workflow

### 1. Local Development
```bash
# Start Firestore emulator for testing
firebase emulators:start --only firestore

# Run migration against emulator
npm run seed-firestore
```

### 2. Staging Environment
```bash
# Deploy to staging project
firebase use staging
npm run seed-firestore
firebase deploy --only firestore
```

### 3. Production Deployment
```bash
# Deploy to production (be careful!)
firebase use production
firebase deploy --only firestore:rules,firestore:indexes
```

## Troubleshooting

### Common Issues

1. **Environment Variables Missing**
   - Ensure all Firebase credentials are properly set in `.env.local`
   - Check that private key is properly escaped

2. **Permission Errors**
   - Verify service account has Firestore Admin role
   - Check that project ID matches your Firebase project

3. **Index Creation Errors**
   - Deploy indexes manually: `firebase deploy --only firestore:indexes`
   - Wait for indexes to build before testing queries

### Debugging

Enable detailed logging by setting:
```bash
export DEBUG=firebase-admin:firestore
npm run seed-firestore
```

## Security Considerations

- **Service Account**: Keep service account credentials secure
- **Rule Testing**: Test security rules thoroughly before production deployment
- **Data Validation**: Always validate data before writing to Firestore
- **Access Patterns**: Review and audit data access patterns regularly

## Future Enhancements

- Add data validation schemas using Zod
- Implement incremental migration support
- Add rollback functionality for failed migrations
- Create automated tests for security rules
- Add monitoring and alerting for migration failures

## Support

For issues or questions about the migration:

1. Check the console output for detailed error messages
2. Review the security rules for access issues
3. Verify environment variables and Firebase project setup
4. Test with Firestore emulator first

## License

This migration system is part of the PrepBettr application and follows the same license terms.
