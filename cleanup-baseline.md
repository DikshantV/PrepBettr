# Cleanup Branch Baseline - Test Status

## Branch: cleanup/unused-assets
**Date**: 2024-07-24 15:38 (cleanup branch created)
**Purpose**: Document baseline test status before unused asset cleanup

## Unit Test Results (Jest)
- **Total Test Suites**: 2 (1 failed, 1 passed)
- **Total Tests**: 30 (7 failed, 23 passed)
- **Failing Test Suite**: `tests/quota-middleware.test.ts`
- **Passing Test Suite**: `tests/webhook-integration.test.ts`

### Coverage Report
```
---------------------|---------|----------|---------|---------|---------------------------------
File                 | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s               
---------------------|---------|----------|---------|---------|---------------------------------
All files            |   40.69 |    33.78 |   33.33 |   40.69 |                                 
quota-middleware.ts  |   40.69 |    33.78 |   33.33 |   40.69 | 105-118,147-177,200-231,239-331 
---------------------|---------|----------|---------|---------|---------------------------------
```

### Failed Tests
1. **quota-middleware.test.ts** (7 failures):
   - Production Mode tests failing due to `subscriptionService.canPerformAction is not a function`
   - Feature-specific behavior tests failing with similar subscription service issues
   - Custom usage document ID tests failing with service call issues

## E2E Test Results (Playwright)
- **Total Tests**: 27 (all failed)
- **Issue**: Authentication failures - all tests timing out on sign-in, getting redirected to `/sign-in` instead of `/dashboard`
- **Browsers**: Chromium, Firefox, WebKit - all failing consistently

### Failed E2E Test Categories
1. Free User Quota Limits (3 tests per browser)
2. Premium User Unlimited Access (3 tests per browser)  
3. Quota Reset and Edge Cases (2 tests per browser)
4. Upgrade Flow Integration (1 test per browser)

## Known Issues
1. **Subscription Service**: Mock implementation issues causing quota middleware failures
2. **Authentication Flow**: E2E tests unable to complete sign-in process
3. **Test Environment**: Authentication state persistence issues in test environment

## Next Steps
This baseline shows we have a mix of passing and failing tests. The cleanup work should not affect these test results since we're only removing unused assets. We'll compare against this baseline after cleanup to ensure no regressions.

## Coverage Baseline
- **Statement Coverage**: 40.69%
- **Branch Coverage**: 33.78%
- **Function Coverage**: 33.33%
- **Line Coverage**: 40.69%

The coverage should remain the same or potentially improve if we remove dead code during cleanup.

## Saved Coverage Files
- **Location**: `./coverage-baseline-cleanup/`
- **Files Saved**: 
  - `coverage-final.json` - Complete coverage data
  - `lcov.info` - LCOV format coverage
  - `clover.xml` - Clover XML format
  - `lcov-report/` - HTML coverage report
