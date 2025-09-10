# Azure AI Foundry Voice Testing Suite

This directory contains a comprehensive testing suite for the Azure AI Foundry voice interview system integration. The tests cover unit, integration, and end-to-end scenarios to ensure the voice system works reliably across all layers.

## Test Architecture

The testing suite follows a three-tier approach:

### 1. Unit Tests (`*.test.ts`)
- **VoiceLiveClient Tests** (`voice-live-client.test.ts`)
  - WebSocket connection management
  - Exponential backoff reconnection logic
  - Message handling for all Azure OpenAI Realtime API events
  - Audio streaming and text messaging
  - Session management and error handling
  - Resource cleanup

- **VoiceSession Tests** (`voice-session.test.ts`)
  - Session creation with custom parameters
  - Event handling (transcripts, audio responses, errors)
  - Configuration validation
  - Session lifecycle management
  - Telemetry integration
  - Settings updates

### 2. Integration Tests (`voice-integration.test.ts`)
- End-to-end voice conversation flow with mocked Azure WebSocket
- Mixed audio and text conversation scenarios
- Error handling and recovery testing
- Performance and latency measurements
- Session state management across operations
- Resource cleanup and multiple session cycles

### 3. End-to-End Tests (`../e2e/voice-interview-foundry.spec.ts`)
- Complete user experience with Playwright
- Feature flag testing (v2 vs legacy system)
- Microphone permission handling
- Audio recording and streaming simulation
- Text-to-speech playback verification
- Settings panel functionality
- Connection error scenarios
- Accessibility compliance testing
- Session persistence across navigation

## Key Testing Features

### Mock Infrastructure
- **Enhanced WebSocket Mocking**: Realistic Azure OpenAI Realtime API simulation
- **Audio API Mocks**: Web Audio API, MediaStream, and AudioContext simulation
- **Feature Flag Integration**: Dynamic switching between legacy and Foundry systems
- **Timer Management**: Precise control over async operations and reconnection testing

### Coverage Targets
- **Unit Tests**: 85% coverage for core voice modules
- **Overall**: 80% coverage threshold
- **Critical Paths**: 100% coverage for error handling and connection management

### Test Scenarios Covered

#### Connection Management
- ✅ WebSocket connection establishment
- ✅ Connection failure handling
- ✅ Exponential backoff reconnection
- ✅ Maximum retry attempts enforcement
- ✅ Clean disconnection and resource cleanup

#### Audio Processing
- ✅ Audio streaming with multiple chunks
- ✅ High-frequency audio data handling
- ✅ Transcript generation and processing
- ✅ Audio response playback
- ✅ Mixed audio/text conversations

#### Session Management
- ✅ Session creation with custom parameters
- ✅ Configuration validation and error handling
- ✅ Mid-session settings updates
- ✅ Session state persistence
- ✅ Multiple session lifecycle testing

#### Error Handling
- ✅ Network connection failures
- ✅ API error responses
- ✅ Invalid operation attempts
- ✅ Resource cleanup on errors
- ✅ User-friendly error messaging

#### Performance
- ✅ End-to-end latency measurement
- ✅ High-frequency operations handling
- ✅ Memory leak prevention
- ✅ Resource utilization monitoring

## Running the Tests

### Unit and Integration Tests
```bash
# Run all Azure AI Foundry voice tests
npm run test:voice-foundry

# Run tests in watch mode
npm run test:voice-foundry:watch

# Run tests with coverage report
npm run test:voice-foundry:coverage
```

### End-to-End Tests
```bash
# Run E2E tests for Azure AI Foundry voice features
npm run test:e2e:voice:foundry
```

### Individual Test Suites
```bash
# Run specific test files
npx jest tests/azure-ai-foundry/voice/voice-live-client.test.ts
npx jest tests/azure-ai-foundry/voice/voice-session.test.ts
npx jest tests/azure-ai-foundry/voice/voice-integration.test.ts
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- **Environment**: jsdom for browser API simulation
- **Module Mapping**: Proper path resolution for `@/` imports
- **Coverage**: Focused on voice module components
- **Timeout**: Extended to 30 seconds for WebSocket operations
- **TypeScript**: Full ts-jest integration with React JSX support

### Test Setup (`setup.ts`)
- **Mock APIs**: Web Audio API, MediaStream, AudioContext
- **Globals**: Crypto API for UUID generation
- **Storage**: localStorage and sessionStorage mocking
- **Console**: Noise reduction while preserving error/warn logs
- **Cleanup**: Automatic mock reset between tests

## Integration with CI/CD

The test suite is designed for CI/CD integration with:

- **Deterministic Timing**: Fake timers for consistent test execution
- **Mock WebSocket**: No external dependencies for reliable testing
- **Coverage Reports**: Detailed coverage metrics for code quality gates
- **Parallel Execution**: Tests can run independently without shared state
- **Error Reporting**: Structured error reporting for debugging

## Test Data and Fixtures

### Mock Azure Responses
The tests use realistic Azure OpenAI Realtime API response formats:
- Session creation events
- Transcript completion events
- Audio delta streaming
- Error responses
- Session updates

### Audio Test Data
- Base64 encoded mock audio data
- Various audio chunk sizes for streaming tests
- Realistic audio processing latencies

## Debugging Tests

### Common Issues and Solutions

1. **WebSocket Connection Errors**
   ```bash
   # Check mock WebSocket setup in setup.ts
   # Verify timer advancement in integration tests
   ```

2. **Module Resolution Issues**
   ```bash
   # Ensure moduleNameMapper in jest.config.js is correct
   # Check that Azure AI Foundry modules exist
   ```

3. **Async Operation Timing**
   ```bash
   # Use jest.advanceTimersByTime() for timer-dependent tests
   # Ensure proper cleanup with jest.clearAllTimers()
   ```

### Test Debugging Tools

- **Timer Helpers**: `mockTimerHelpers` for time manipulation
- **WebSocket Inspector**: Enhanced mock with message logging
- **Coverage Reports**: Identify untested code paths
- **Verbose Mode**: Detailed test execution logs

## Future Enhancements

### Planned Test Additions
- [ ] Load testing with multiple concurrent sessions
- [ ] Network interruption simulation
- [ ] Browser compatibility testing
- [ ] Mobile device audio API testing
- [ ] Real Azure service integration tests (staging environment)

### Performance Testing Expansion
- [ ] Memory usage profiling
- [ ] CPU utilization monitoring
- [ ] Audio quality measurement
- [ ] Latency distribution analysis

## Maintenance

### Regular Test Updates
- Update mock data when Azure API changes
- Refresh audio test fixtures periodically
- Review coverage thresholds quarterly
- Update browser API mocks for new features

### Monitoring Test Health
- CI/CD test execution time tracking
- Flaky test identification and resolution
- Mock accuracy validation against real services
- Coverage trend analysis

This comprehensive testing suite ensures the Azure AI Foundry voice integration is robust, reliable, and user-friendly across all deployment scenarios.
