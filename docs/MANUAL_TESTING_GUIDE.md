# Manual Testing Guide: Quota Reset on Downgrade

This guide provides step-by-step instructions for manually testing the quota counter reset functionality when users downgrade from premium to free plans.

## Overview

When a user cancels their premium subscription (downgrades to free), their usage counters should be reset to ensure they start fresh with their free tier limits.

## Prerequisites

Before starting these tests, ensure you have:

1. ✅ Local development server running (`npm run dev`)
2. ✅ Firebase emulator running (`firebase emulators:start`)
3. ✅ Test user accounts (both free and premium)
4. ✅ Access to webhook testing tools
5. ✅ Admin access to view/modify Firestore data

## Test Scenarios

### Scenario 1: Premium User with Usage → Subscription Cancellation → Quota Reset

#### Step 1: Setup Premium User
1. Sign in as a premium test user
2. Navigate to `/dashboard/usage` to verify premium status
3. Expected: User shows "Premium" plan with "Unlimited" usage limits

#### Step 2: Generate Usage Data
1. **Generate Interviews**
   - Go to `/dashboard/interviews`
   - Generate 10+ interview sets (above free tier limits)
   - Verify each generation is successful

2. **Tailor Resumes**
   - Go to `/dashboard/resume-tailor`
   - Process 8+ resume tailoring requests (above free tier limits)
   - Verify each request is successful

3. **Auto-Apply Jobs**
   - Go to `/dashboard/auto-apply`
   - Submit 25+ job applications (above free tier limits)
   - Verify each application is successful

4. **Verify Usage Counters**
   - Check Firestore `users/{userId}/usage` document
   - Expected counters:
     ```json
     {
       "interviews": { "count": 10+, "limit": -1 },
       "resumeTailor": { "count": 8+, "limit": -1 },
       "autoApply": { "count": 25+, "limit": -1 }
     }
     ```

#### Step 3: Simulate Subscription Cancellation
Using the webhook testing tool:

1. **Send Subscription Deleted Webhook**
   ```bash
   node tests/webhook-emulator-test.js
   ```
   
   Or manually with curl:
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/dodo \
     -H "Content-Type: application/json" \
     -H "x-dodo-signature: [generated_signature]" \
     -d '{
       "id": "evt_manual_test_' $(date +%s) '",
       "type": "customer.subscription.deleted",
       "created": ' $(date +%s) ',
       "data": {
         "object": {
           "id": "sub_test_cancelled",
           "status": "canceled",
           "metadata": {
             "userId": "YOUR_TEST_USER_ID"
           }
         }
       }
     }'
   ```

2. **Verify Webhook Response**
   - Status: 200 OK
   - Response should indicate successful processing
   - Check server logs for quota reset confirmation

#### Step 4: Verify Quota Reset
1. **Check Firestore Data**
   - Navigate to Firestore console/emulator
   - Check `users/{userId}/usage` document
   - Expected after reset:
     ```json
     {
       "interviews": { "count": 0, "limit": 5 },
       "resumeTailor": { "count": 0, "limit": 3 },
       "autoApply": { "count": 0, "limit": 10 }
     }
     ```

2. **Check Subscription Status**
   - Check `users/{userId}/subscription` document
   - Expected:
     ```json
     {
       "plan": "free",
       "status": "cancelled",
       "cancelledAt": "[timestamp]"
     }
     ```

3. **Verify UI Changes**
   - Refresh browser/clear cache
   - Navigate to `/dashboard/usage`
   - Expected: Shows "Free" plan with proper limits and reset counters

#### Step 5: Test Free Tier Limitations
1. **Test Interview Generation Limit**
   - Generate interviews until limit reached (should be 5)
   - 6th attempt should show upgrade prompt

2. **Test Resume Tailoring Limit**
   - Process resumes until limit reached (should be 3)
   - 4th attempt should show upgrade prompt

3. **Test Auto-Apply Limit**
   - Submit applications until limit reached (should be 10)
   - 11th attempt should show upgrade prompt

### Scenario 2: Edge Cases Testing

#### Test Case A: Multiple Cancellation Webhooks (Idempotency)
1. Send the same subscription cancellation webhook 3 times
2. Verify only first one processes the reset
3. Subsequent webhooks should be idempotent
4. Quota counters should remain at reset values

#### Test Case B: Cancellation Without Prior Usage
1. Create fresh premium user (no usage)
2. Immediately cancel subscription
3. Verify reset works correctly with zero usage

#### Test Case C: Partial Usage Reset
1. Create premium user with mixed usage levels
2. Cancel subscription
3. Verify all counters reset regardless of individual usage

#### Test Case D: Resubscription After Cancellation
1. Cancel premium subscription (counters reset)
2. Re-subscribe to premium
3. Verify counters remain reset but limits become unlimited
4. Test that new usage starts from zero

### Scenario 3: Error Handling

#### Test Case A: Invalid User ID in Webhook
1. Send cancellation webhook with non-existent userId
2. Verify graceful error handling
3. No system crashes or data corruption

#### Test Case B: Database Connection Issues
1. Temporarily disconnect from Firestore
2. Send cancellation webhook
3. Verify proper error responses
4. Test retry mechanism if implemented

#### Test Case C: Malformed Webhook Data
1. Send webhook with missing metadata
2. Send webhook with invalid structure
3. Verify proper error handling

## Verification Checklist

After completing manual tests, verify:

- [ ] Premium users can use features beyond free limits
- [ ] Subscription cancellation webhook processes successfully
- [ ] Usage counters reset to zero on downgrade
- [ ] Plan status changes from premium to free
- [ ] Free tier limits are properly enforced after reset
- [ ] Upgrade prompts appear at correct thresholds
- [ ] UI reflects updated plan and usage status
- [ ] Multiple cancellation webhooks handled idempotently
- [ ] Error scenarios handled gracefully
- [ ] Database integrity maintained throughout process

## Troubleshooting

### Common Issues

1. **Quota Not Resetting**
   - Check webhook signature verification
   - Verify user ID in webhook metadata
   - Check Firestore permissions
   - Review server error logs

2. **UI Not Updating**
   - Clear browser cache
   - Check for client-side caching issues
   - Verify API response data

3. **Webhook Failing**
   - Validate webhook secret configuration
   - Check payload structure
   - Verify signature generation

4. **Database Errors**
   - Ensure Firestore emulator is running
   - Check connection configuration
   - Verify document structure

### Debug Commands

```bash
# Check server logs
tail -f server.log

# Test webhook signature generation
node test-webhook-signature.js YOUR_WEBHOOK_SECRET

# Verify Firestore data
firebase firestore:get users/YOUR_USER_ID/usage --emulator

# Test API endpoints directly
curl -H "Cookie: session=YOUR_SESSION_TOKEN" \
  http://localhost:3000/api/user/usage
```

### Test Data Cleanup

After testing, clean up:

```bash
# Clear test data from Firestore emulator
firebase firestore:clear --emulator

# Remove test webhook events
# (Check your webhook event tracking system)
```

## Reporting Issues

When reporting issues found during manual testing:

1. **Include Environment Details**
   - Node.js version
   - Browser used
   - Operating system
   - Local vs. production environment

2. **Provide Reproduction Steps**
   - Exact steps taken
   - Expected vs. actual behavior
   - Screenshots if UI-related

3. **Attach Logs**
   - Server error logs
   - Browser console errors
   - Network request/response data

4. **Test Data**
   - User IDs used
   - Webhook payloads sent
   - Timestamp of tests

## Automation Recommendations

Consider automating these manual tests:

1. **Playwright E2E Tests**
   - User journey from premium usage to cancellation
   - UI verification of plan changes
   - Quota enforcement testing

2. **API Integration Tests**
   - Webhook processing accuracy
   - Database state verification
   - Error handling scenarios

3. **Load Testing**
   - Multiple concurrent cancellations
   - High-usage scenarios before reset
   - System stability under load

Remember to run these manual tests regularly, especially:
- Before production deployments
- After quota system modifications  
- When payment provider changes
- During subscription flow updates
