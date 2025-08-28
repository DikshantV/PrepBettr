# Headless Automation Test Suite

Comprehensive test suite for the headless browser automation system and Azure Cosmos DB integration.

## Overview

This test suite covers:

- **Headless Browser Service**: Browser management, job portal detection, form filling, screening questions, resume upload, and application submission
- **Azure Cosmos DB Integration**: Document CRUD operations, querying, application-specific operations, error handling, and performance monitoring
- **Application Worker Integration**: End-to-end integration between headless automation and database storage
- **Error Handling & Resilience**: Rate limiting, retries, timeouts, and graceful degradation

## Test Structure

```
tests/
├── headless-browser-automation.test.js    # Headless browser service tests
├── azure-cosmos-integration.test.js       # Azure Cosmos DB integration tests
├── jest.config.js                         # Jest configuration
├── setup.js                              # Test setup and custom matchers
├── global-setup.js                       # Global test initialization
├── global-teardown.js                    # Global test cleanup
├── package.json                          # Test dependencies and scripts
└── README.md                             # This file
```

## Prerequisites

1. **Node.js** >= 18.0.0
2. **Test dependencies** (automatically installed):
   - Jest testing framework
   - Playwright (mocked in tests)
   - Azure SDK mocks

## Installation

```bash
# Navigate to tests directory
cd tests/

# Install test dependencies
npm install

# Set up test environment
npm run setup
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with verbose output
npm run test:verbose
```

### Specific Test Suites

```bash
# Run only headless browser tests
npm run test:headless-browser

# Run only Azure Cosmos DB tests
npm run test:azure-cosmos

# Run integration tests
npm run test:integration

# Run unit tests only
npm run test:unit
```

### CI/CD Commands

```bash
# Run tests for CI environment
npm run test:ci

# Generate coverage report
npm run coverage:report

# Open coverage report in browser
npm run coverage:open
```

### Development & Debugging

```bash
# Debug tests with Node.js inspector
npm run test:debug

# Clean test artifacts
npm run clean

# Lint test files
npm run lint:tests
```

## Test Features

### Custom Jest Matchers

The test suite includes custom matchers for domain-specific assertions:

```javascript
// Application ID validation
expect('app-123').toBeValidApplicationId();

// User ID validation
expect('user-456').toBeValidUserId();

// Job ID validation
expect('job-789').toBeValidJobId();

// Application status validation
expect('applied').toBeValidApplicationStatus();

// Timestamp validation
expect(application).toHaveValidTimestamp('appliedAt');

// Automation details validation
expect(application).toHaveAutomationDetails();

// Time range validation
expect(timestamp).toBeWithinTimeRange(start, end);
```

### Test Utilities

Global utilities available in all tests:

```javascript
// Create mock data
const application = testUtils.createMockApplication({
  status: 'pending'
});

const userProfile = testUtils.createMockUserProfile({
  experienceYears: 3
});

const jobListing = testUtils.createMockJobListing({
  easy_apply: false
});

// Time utilities
const pastTime = testUtils.getTimeAgo(30); // 30 minutes ago
const futureTime = testUtils.getTimeFromNow(60); // 60 minutes from now

// Mock browser/page objects
const mockPage = testUtils.createMockPlaywrightPage();
const mockBrowser = testUtils.createMockPlaywrightBrowser();

// Mock Cosmos DB responses
const mockResponse = testUtils.createMockCosmosResponse(data, 201);
const mockIterator = testUtils.createMockQueryIterator(results);
```

## Test Coverage

The test suite aims for high coverage across:

- **Functions**: 80%+ coverage
- **Lines**: 80%+ coverage  
- **Branches**: 80%+ coverage
- **Statements**: 80%+ coverage

Critical services have higher thresholds:
- **Headless Browser Service**: 85%+ functions, 85%+ lines
- **Azure Cosmos Service**: 85%+ functions, 85%+ lines

## Test Categories

### 1. Headless Browser Automation Tests

- **Service Initialization**: Configuration validation, health status
- **Browser Management**: Launch, tracking, concurrency limits, cleanup
- **Job Portal Detection**: LinkedIn, Indeed, TheirStack, generic fallback
- **Form Filling**: User data mapping, field detection, error handling
- **Screening Questions**: AI-powered responses, form submission
- **Resume Upload**: File handling, upload validation
- **Application Submission**: Success detection, error handling, retry logic
- **End-to-End Flow**: Complete application process, validation
- **Rate Limiting**: Concurrency control, queue management
- **Screenshots & Debugging**: Capture, storage, error scenarios
- **Resource Management**: Cleanup, memory management

### 2. Azure Cosmos DB Integration Tests

- **Service Initialization**: Configuration, container setup, error handling
- **Document Creation**: Application records, timestamps, error mapping
- **Document Retrieval**: By ID, partition key, non-existent handling
- **Document Querying**: User applications, status filtering, complex queries, pagination
- **Document Updates**: Full replacement, partial updates, merging
- **Document Deletion**: Success cases, non-existent handling
- **Application Operations**: Counting, statistics, recent applications, duplicates
- **Error Handling**: Throttling, retries, connection errors, detailed error info
- **Performance Monitoring**: RU tracking, metrics, health checks

### 3. Integration Tests

- **Worker Integration**: Application storage, automation coordination
- **Error Scenarios**: Automation failures, fallback handling
- **Manual Fallback**: Non-easy-apply jobs, manual intervention required

## Environment Variables

Test environment uses these variables:

```bash
NODE_ENV=test
AZURE_COSMOS_ENDPOINT=https://test-cosmos.documents.azure.com:443/
AZURE_COSMOS_DATABASE_ID=test-db
AZURE_OPENAI_ENDPOINT=https://test-openai.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview
DISABLE_EXTERNAL_CALLS=true
MOCK_BROWSER_SERVICE=true
MOCK_COSMOS_DB=true
```

## Continuous Integration

The test suite is designed for CI/CD pipelines:

```bash
# Install dependencies
npm ci

# Run tests with coverage
npm run test:ci

# The exit code will be 0 for success, non-zero for failures
```

Test results are output in multiple formats:
- **Console**: Real-time feedback
- **JUnit XML**: `tests/reports/test-results.xml`
- **Coverage HTML**: `tests/coverage/index.html`
- **Coverage LCOV**: `tests/coverage/lcov.info`

## Troubleshooting

### Common Issues

1. **Test Timeout**: Increase timeout in `jest.config.js` if needed
2. **Mock Issues**: Check mock setup in `setup.js`
3. **Environment Variables**: Verify test environment configuration
4. **Coverage Thresholds**: Adjust thresholds if needed during development

### Debug Mode

Use debug mode for troubleshooting:

```bash
npm run test:debug
```

Then connect to `chrome://inspect` in Chrome browser.

### Verbose Logging

Enable verbose output:

```bash
npm run test:verbose
```

### Clean Start

If tests behave unexpectedly:

```bash
npm run clean
npm run setup
npm test
```

## Contributing

When adding new tests:

1. **Follow naming conventions**: `describe` blocks should be descriptive
2. **Use custom matchers**: When available for domain-specific assertions  
3. **Mock external dependencies**: Use provided mock utilities
4. **Test error scenarios**: Include both success and failure cases
5. **Update coverage**: Maintain or improve coverage thresholds
6. **Document complex tests**: Add comments for complex test logic

## Performance

Test execution performance:
- **Parallel execution**: Tests run in parallel by default
- **Mock optimization**: External calls are mocked for speed
- **Resource cleanup**: Automatic cleanup after test completion
- **Selective running**: Target specific test suites during development

Expected test runtime: ~30-60 seconds for full suite.

# Automated Testing Suite

This testing suite provides comprehensive coverage for the PrepBettr application, including unit tests, integration tests, end-to-end tests, and load testing.

## Overview

The testing suite is designed to ensure high quality and reliability through:

- **Unit Tests**: Jest-based tests for individual components and services (≥80% coverage required)
- **Firestore Rules Testing**: Firebase Rules Unit Testing with emulator
- **Integration Tests**: Playwright tests hitting staging Functions + emulated Firestore
- **Load Testing**: k6 scripts for queue throughput and performance testing
- **GitHub Actions**: Automated CI/CD pipeline with coverage enforcement

## Test Structure

```
tests/
├── README.md                          # This file
├── global-setup.ts                    # Jest global setup for Firebase emulators
├── global-teardown.ts                 # Jest global teardown
├── setup.ts                           # Jest test environment setup
├── firestore-rules.test.ts           # Firestore security rules tests
├── integration/                       # Integration tests
│   └── staging-functions.spec.ts      # Staging environment integration tests
└── load/                             # Load testing scripts
    └── queue-throughput.js           # k6 load testing script

services/
└── __tests__/
    └── firebase.service.test.ts       # Service layer unit tests
```

## Prerequisites

1. **Node.js** (v18 or later)
2. **Firebase CLI** (`npm install -g firebase-tools`)
3. **k6** for load testing
4. **Playwright** browsers

### Installing k6 (Linux/Ubuntu)
```bash
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver keyserver.ubuntu.com --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Installing k6 (macOS)
```bash
brew install k6
```

## Running Tests

### Unit Tests

Run all unit tests with coverage:
```bash
npm run test:coverage
```

Run specific test suites:
```bash
# Audio utilities tests
npm run test:unit:audio

# Voice state machine tests
npm run test:unit:state

# Service layer tests
npm run test:services

# Firestore rules tests
npm run test:firestore-rules
```

### Integration Tests

#### Local Integration Tests
```bash
# Start Firebase emulators
npm run test:emulators:start

# Run integration tests (in another terminal)
npm run test:integration:staging

# Stop emulators
npm run test:emulators:stop
```

#### End-to-End Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run specific E2E test suites
npm run test:auth-flow
npm run test:e2e:quota
npm run test:e2e:voice:enhanced
```

### Load Testing

Run load tests with k6:
```bash
# Basic load test
npm run test:load:k6

# Custom load test with parameters
k6 run tests/load/queue-throughput.js \
  --env BASE_URL=https://your-staging-url.com \
  --env FIRESTORE_EMULATOR_HOST=localhost:8080
```

### Complete Test Suite

Run the full test suite:
```bash
npm run test:suite:full
```

## Coverage Requirements

The CI/CD pipeline enforces a **minimum 80% code coverage** threshold. Tests will fail if coverage drops below this threshold.

Coverage areas include:
- **Lines**: ≥80%
- **Functions**: ≥80%
- **Branches**: ≥80%
- **Statements**: ≥80%

## Firebase Emulator Setup

### Starting Emulators Manually

```bash
# Start all emulators for testing
firebase emulators:start --only firestore,auth,storage --project test-project

# Import test data (optional)
firebase emulators:start --only firestore,auth,storage --import=./tests/fixtures/emulator-data
```

### Environment Variables for Testing

```bash
export FIRESTORE_EMULATOR_HOST=localhost:8080
export FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
export FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
export GCLOUD_PROJECT=test-project
export NODE_ENV=test
```

## Test Categories

### 1. Unit Tests (Jest)

**Location**: `lib/`, `services/`
**Framework**: Jest with ts-jest
**Coverage**: Enforced at 80%

Example test command:
```bash
jest services/__tests__/firebase.service.test.ts --coverage
```

### 2. Firestore Rules Tests

**Location**: `tests/firestore-rules.test.ts`
**Framework**: Firebase Rules Unit Testing
**Purpose**: Validate security rules work correctly

Tests cover:
- User document access control
- Interview privacy rules
- Usage tracking permissions
- Application data security

### 3. Integration Tests (Playwright)

**Location**: `tests/integration/`
**Framework**: Playwright
**Environment**: Staging + Firestore emulator

Tests include:
- Interview generation flow
- Resume processing workflow
- Voice interview sessions
- API rate limiting
- Error handling
- Performance within budgets

### 4. Load Tests (k6)

**Location**: `tests/load/`
**Framework**: k6
**Purpose**: Queue throughput and performance testing

Load test scenarios:
- **Spike Test**: Sudden load increase (50 concurrent users)
- **Load Test**: Sustained load (20 concurrent users, 5 minutes)
- **Stress Test**: Beyond normal capacity (100 concurrent users)

Performance thresholds:
- 95% of requests under 2 seconds
- Error rate under 5%
- Queue processing success rate >95%

## CI/CD Integration

### GitHub Actions Workflow

The comprehensive CI/CD pipeline includes:

1. **Linting & Type Checking**
2. **Unit Tests** (with 80% coverage enforcement)
3. **Firestore Rules Tests**
4. **Service Layer Tests**
5. **Integration Tests**
6. **E2E Tests**
7. **Staging Integration Tests**
8. **Load Testing** (on main branch)
9. **Build Verification**
10. **Security Audit**

### Coverage Enforcement

The pipeline automatically fails if:
- Unit test coverage drops below 80%
- Any test suite fails
- Load test SLA requirements aren't met
- Build verification fails

### Branch Protection

Main branch merges are blocked when:
- CI checks fail
- Coverage threshold not met
- Integration tests fail
- Security vulnerabilities detected

## Writing Tests

### Unit Test Example

```typescript
// services/__tests__/example.service.test.ts
import { ExampleService } from '../example.service';

describe('ExampleService', () => {
  let service: ExampleService;

  beforeEach(() => {
    service = new ExampleService();
  });

  it('should perform expected operation', async () => {
    const result = await service.performOperation('test-data');
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});
```

### Firestore Rules Test Example

```typescript
// tests/firestore-rules.test.ts
it('should allow users to read their own data', async () => {
  const userId = 'test-user-id';
  const context = testEnv.authenticatedContext(userId);
  const userDoc = context.firestore().doc(`users/${userId}`);
  
  await expect(userDoc.get()).resolves.not.toThrow();
});
```

### Integration Test Example

```typescript
// tests/integration/example.spec.ts
test('should complete workflow end-to-end', async ({ page, request }) => {
  await page.goto('/dashboard');
  await page.fill('[data-testid="input-field"]', 'test data');
  await page.click('[data-testid="submit-button"]');
  
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

## Debugging Tests

### Jest Debugging

```bash
# Run tests in watch mode
npm run test:watch

# Debug specific test
node --inspect-brk node_modules/.bin/jest --runInBand tests/specific.test.ts
```

### Playwright Debugging

```bash
# Run with UI mode
npm run test:e2e:dev

# Run with headed browser
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

### Firebase Emulator Debugging

```bash
# View emulator UI
firebase emulators:start --only firestore,auth,storage --project test-project
# Navigate to http://localhost:4000
```

## Performance Monitoring

### Load Test Metrics

The k6 load tests track:
- **Response Times**: Average, P95, P99
- **Throughput**: Requests per second
- **Error Rates**: Failed request percentage
- **Queue Metrics**: Processing times for different operations

### SLA Requirements

- **P95 Response Time**: <2000ms
- **Error Rate**: <5%
- **Queue Success Rate**: >95%
- **Interview Generation**: <10s (P90)
- **Resume Processing**: <15s (P90)

## Troubleshooting

### Common Issues

1. **Emulator Connection Failed**
   - Ensure emulators are running: `firebase emulators:start`
   - Check port availability (8080, 9099, 9199)

2. **Coverage Below 80%**
   - Add tests for uncovered lines
   - Remove unused code
   - Use coverage report: `npm run test:coverage`

3. **Load Test Failures**
   - Check staging environment availability
   - Verify network connectivity
   - Review k6 script configuration

4. **Playwright Test Timeouts**
   - Increase timeout values in playwright.config.ts
   - Check staging environment response times
   - Verify test data setup

### Getting Help

1. Check test logs in GitHub Actions
2. Run tests locally to reproduce issues
3. Use debug modes for detailed information
4. Review coverage reports for missing tests

## Contributing

When adding new features:

1. Write unit tests for new functions/services
2. Update integration tests for new workflows
3. Add E2E tests for new user journeys
4. Update load tests if new endpoints are added
5. Ensure coverage stays ≥80%

### Test Naming Conventions

- Unit tests: `*.test.ts`
- Integration tests: `*.spec.ts`
- E2E tests: `*.spec.ts`
- Load tests: `*.js` (k6 format)

### Best Practices

1. **Arrange-Act-Assert** pattern for unit tests
2. **Page Object Model** for E2E tests
3. **Data-driven** load testing scenarios
4. **Mock external dependencies** in unit tests
5. **Use real services** in integration tests
6. **Clean up test data** after each test
