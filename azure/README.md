# Azure Functions - Queue-Based Processing System

This directory contains Azure Functions for handling queue-based processing of job automation tasks in the PrepBettr application.

## Architecture Overview

The system uses Azure Queue Storage to decouple heavy processing tasks and consists of four main Function Apps:

### 1. searchScheduler
**Purpose**: Schedules and manages automated job searches for users with auto-apply enabled.

**Triggers**:
- Timer trigger (every 15 minutes)
- HTTP trigger for manual job search requests

**Functionality**:
- Monitors users with active auto-apply settings
- Determines when users need new job searches based on frequency settings
- Queues job search requests with appropriate priorities
- Respects daily application limits and user preferences

### 2. jobSearchWorker  
**Purpose**: Processes job search requests from the search queue.

**Triggers**:
- Queue trigger (`search-jobs` queue)

**Functionality**:
- Searches job portals (LinkedIn, Indeed, etc.) based on user filters
- Calculates job relevancy scores using AI (Azure OpenAI)
- Filters jobs based on relevancy thresholds
- Queues qualifying jobs for auto-apply processing
- Stores discovered jobs for user review

### 3. applicationWorker
**Purpose**: Processes job applications from the application queue.

**Triggers**:
- Queue trigger (`process-applications` queue)

**Functionality**:
- Validates application eligibility (no duplicates, meets thresholds)
- Generates AI-powered cover letters using Azure OpenAI
- Tailors resumes for specific job requirements
- Submits applications to job portals
- Schedules follow-up reminders
- Tracks application status and logs all activities

### 4. followUpWorker
**Purpose**: Handles automated follow-up communications for submitted applications.

**Triggers**:
- Queue trigger (`follow-up-reminders` queue)

**Functionality**:
- Processes scheduled follow-up reminders
- Generates personalized follow-up messages using AI
- Sends initial and secondary follow-ups based on user settings
- Handles thank you notes and status check inquiries
- Manages follow-up sequences and prevents duplicates

## Queue System

### Queue Types
1. **search-jobs**: Job search requests from the scheduler
2. **process-applications**: Individual job applications to be processed
3. **follow-up-reminders**: Scheduled follow-up tasks
4. **automation-logs**: Centralized logging for all automation activities

### Queue Configuration
- **Visibility Timeout**: 30 seconds (configurable per message)
- **Batch Size**: 16 messages per function execution
- **Max Dequeue Count**: 5 (with exponential backoff retry)
- **Polling Interval**: 2 seconds

## Automation Logging

All functions utilize a centralized logging system that:
- Writes structured logs to Azure Queue Storage (`automation-logs` queue)
- Integrates with Application Insights for monitoring and alerting
- Provides real-time visibility into automation activities
- Tracks success rates, error patterns, and performance metrics

### Log Entry Types
- `job_discovered`: New job found matching user criteria
- `application_submitted`: Job application processed
- `follow_up_sent`: Follow-up communication sent
- `search_scheduler_started/completed`: Scheduler execution
- `error`: Any processing errors with full context

## Environment Variables

Required environment variables in `local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "[Storage Account Connection String]",
    "AZURE_OPENAI_KEY": "[Azure OpenAI API Key]",
    "APPINSIGHTS_INSTRUMENTATIONKEY": "[Application Insights Key]",
    "AZURE_OPENAI_KEY": "[Optional: Azure OpenAI Key]",
    "AZURE_OPENAI_ENDPOINT": "[Optional: Azure OpenAI Endpoint]",
    "SENDGRID_API_KEY": "[SendGrid API Key for email notifications]",
    "SENDGRID_FROM_EMAIL": "[Sender email address - e.g., contact@prepbettr.com]"
  }
}
```

### Email Service Configuration

The Azure Functions use SendGrid for sending email notifications including:
- Job application confirmations
- Follow-up reminders
- Daily automation summaries
- Error notifications

**SendGrid Setup Requirements:**
1. Create a SendGrid account and verify your sender email
2. Generate an API key with "Mail Send" permissions
3. Add the API key and sender email to your function app configuration
4. For production, store these values in Azure Key Vault

## Deployment

### Prerequisites
- Azure Functions Core Tools v4
- Node.js 18.x or later
- Azure CLI (for deployment)

### Local Development
```bash
# Install dependencies
cd azure
npm install

# Start the function app locally
npm start
```

### Deploy to Azure
```bash
# Deploy all functions
npm run deploy

# Or deploy individual functions
func azure functionapp publish [function-app-name]
```

## Integration with Main Application

### Triggering Job Searches
The main Next.js application can trigger job searches by calling the searchScheduler HTTP endpoint:

```typescript
const response = await fetch('/api/azure/search-scheduler', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    filters: userSearchFilters,
    immediate: true
  })
});
```

### Queue Job Applications
Applications can be queued directly via the queue service:

```typescript
// From the auto-apply API routes
await queueService.addMessage('process-applications', {
  userId,
  jobId,
  jobListing,
  autoApply: true
});
```

## Monitoring and Alerting

### Application Insights Integration
- Custom telemetry for all automation activities
- Performance counters for queue processing rates
- Exception tracking with full context
- Custom dashboards for automation metrics

### Key Metrics to Monitor
- Queue message processing rates
- Application success/failure rates
- AI API usage and response times
- Daily application counts per user
- Follow-up delivery rates

### Alerting Rules
- Queue message age > 5 minutes
- Function failure rate > 5%
- Daily application limit breaches
- AI API quota approaching limits

## Development Guidelines

### Error Handling
- All functions implement comprehensive error handling
- Errors are logged with full context to aid debugging
- Failed messages are retried with exponential backoff
- Poison messages are handled gracefully

### Performance Optimization
- Batch processing where possible
- Async operations for I/O intensive tasks
- Connection pooling for external services
- Intelligent retry logic with circuit breakers

### Testing
- Unit tests for core business logic
- Integration tests for queue operations
- Mock external service dependencies
- Load testing for queue processing capacity

## Security Considerations

### Data Protection
- All queue messages are base64 encoded
- Sensitive data is stored in Azure Key Vault
- User data is processed according to GDPR requirements
- API keys are rotated regularly

### Access Control
- Function apps use managed identities where possible
- Queue access is restricted to function apps only
- Application Insights data is access-controlled
- Audit logs track all data access

## Troubleshooting

### Common Issues

1. **Queue Messages Not Processing**
   - Check Azure Storage account connection
   - Verify queue names match configuration
   - Review function app logs in Application Insights

2. **High Memory Usage**
   - Monitor concurrent executions
   - Check for memory leaks in AI model usage
   - Optimize batch processing sizes

3. **AI API Rate Limits**
   - Implement exponential backoff
   - Monitor API quotas and usage
   - Consider request queuing for high-volume periods

4. **Application Submission Failures**
   - Verify job portal API credentials
   - Check rate limiting on external services
   - Review authentication token refresh logic

### Debugging
- Use Application Insights Live Metrics for real-time monitoring
- Enable verbose logging in development environments
- Use Azure Storage Explorer to inspect queue contents
- Review function execution history in Azure Portal

## Future Enhancements

### Planned Features
- Integration with additional job portals (Glassdoor, Remote.co)
- Advanced AI-powered job matching algorithms
- Real-time application status tracking
- Bulk operations for enterprise users
- Analytics dashboard for automation insights

### Scalability Improvements
- Auto-scaling based on queue depth
- Regional deployment for reduced latency
- Caching layer for frequently accessed data
- Database connection pooling optimization
