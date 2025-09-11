# Voice System Migration Guide

## Overview

PrepBettr now uses a dual-system voice interview architecture with automatic migration to Azure AI Foundry as the preferred voice system.

## Current Architecture

### Azure AI Foundry Voice System (Preferred) ✅
- **Status**: Active and preferred
- **Component**: `FoundryVoiceAgent`
- **Feature Flag**: `voiceInterviewV2` (default: enabled)
- **Backend**: Azure AI Foundry real-time voice API
- **Features**:
  - Real-time voice processing
  - Advanced sentiment analysis
  - Better latency and reliability
  - Integrated transcript storage
  - Enhanced error recovery

### Legacy Voice System (Deprecated) ⚠️
- **Status**: Deprecated, maintained for backward compatibility
- **Component**: `Agent.tsx` (legacy portion)
- **Backend**: Azure Speech SDK + OpenAI pipeline
- **Migration Timeline**: Planned for removal in v2.0

## Feature Flag Configuration

The voice system selection is controlled by the `voiceInterviewV2` feature flag:

```typescript
// Default configuration
'features.voiceInterviewV2': {
  value: true, // Defaults to Azure AI Foundry system
  type: 'boolean',
  metadata: { 
    source: 'azure', 
    syncToFirebase: true 
  }
}
```

### Rollout Configuration

```typescript
voiceInterviewV2: {
  percentage: 100, // Full rollout (all users)
  featureName: 'voiceInterviewV2'
}
```

## Component Usage

### Current Implementation (Agent.tsx)

```tsx
const Agent = ({ userName, userId, ... }) => {
  // Feature flag check
  const { enabled: useFoundryVoice, loading } = useFeatureFlag('voiceInterviewV2');
  
  if (useFoundryVoice) {
    // Use Azure AI Foundry system
    return <FoundryVoiceAgent {...props} />;
  }
  
  // Fallback to legacy system (deprecated)
  return <LegacyVoiceSystem {...props} />;
};
```

### Migration Path for Developers

#### 1. Current State (Dual System)
- Both systems available
- Feature flag controls selection
- No breaking changes required

#### 2. Migration Recommendations

**For New Features:**
- Always build against `FoundryVoiceAgent`
- Use the `useVoiceAgentBridge` hook
- Leverage Azure AI Foundry capabilities

**For Existing Features:**
- Test with `voiceInterviewV2=true`
- Update any voice-specific logic to use new APIs
- Remove dependencies on legacy azure-adapters

#### 3. Future State (v2.0)
- Remove legacy voice system entirely
- `FoundryVoiceAgent` becomes the only implementation
- Simplified codebase with single voice pipeline

## API Differences

### Legacy System (Azure Speech SDK + OpenAI)
```typescript
// Multiple service calls
const transcript = await speechToText(audioData);
const response = await azureOpenAIService.processResponse(transcript);
const audioResponse = await textToSpeech(response);
```

### Azure AI Foundry System
```typescript
// Unified real-time processing
const { voiceBridge } = useVoiceAgentBridge({
  // Configuration handles all processing
  onTranscriptReceived: (entry) => { /* real-time transcript */ },
  onAgentResponse: (response) => { /* real-time response */ }
});
```

## Testing Strategy

### Development Testing
1. **Default Experience**: Test with `voiceInterviewV2=true` (default)
2. **Legacy Compatibility**: Test with `voiceInterviewV2=false`
3. **Migration Testing**: Switch between systems during session

### E2E Testing
- **Primary**: `voice-interview-foundry.spec.ts` (Azure AI Foundry)
- **Legacy**: `voice-interview.spec.ts` (Speech SDK + OpenAI)
- **Migration**: Test feature flag switching

### Performance Testing
```bash
npm run test:voice-flow        # Test voice interview workflow
npm run test:e2e:voice:enhanced # Enhanced voice E2E tests
```

## Configuration Management

### Azure App Configuration
```json
{
  "features.voiceInterviewV2": true,
  "features.voiceInterview": true    // Legacy flag for compatibility
}
```

### Firebase Remote Config (Synced)
```json
{
  "voiceInterviewV2": true,
  "voiceInterview": true
}
```

## Migration Timeline

### Phase 3 (Current) ✅
- [x] Add `voiceInterviewV2` feature flag
- [x] Default to Azure AI Foundry system
- [x] Full rollout (100% of users)
- [x] Documentation and migration guide

### Phase 4 (Planned)
- [ ] Remove legacy voice adapters
- [ ] Update all voice tests to use Foundry system
- [ ] Remove Azure Speech SDK dependencies
- [ ] Simplify Agent.tsx component

### Phase 5 (v2.0)
- [ ] Remove feature flag checks
- [ ] `FoundryVoiceAgent` becomes the main `VoiceAgent`
- [ ] Clean up legacy imports and dependencies

## Troubleshooting

### Common Issues

#### 1. Feature Flag Not Loading
```typescript
// Check loading state
const { enabled, loading, error } = useFeatureFlag('voiceInterviewV2');

if (loading) return <LoadingSpinner />;
if (error) console.error('Feature flag error:', error);
```

#### 2. Legacy System Fallback
If Azure AI Foundry is unavailable, the system automatically falls back to the legacy system:

```typescript
// Automatic fallback in Agent.tsx
if (useFoundryVoice) {
  return <FoundryVoiceAgent {...props} />;
}
// Falls back to legacy system
```

#### 3. Voice Session Errors
```typescript
// Error handling in FoundryVoiceAgent
const bridgeConfig = {
  onSessionError: (error: Error) => {
    logger.error('Voice session error:', error);
    showErrorNotification(error);
  }
};
```

### Debug Commands
```bash
# Check Azure services health
npm run check:azure

# Test voice system specifically
npm run test:voice-system

# Monitor feature flag status
npm run config:validate
```

## Support and Migration Assistance

### For Developers
- Review `FoundryVoiceAgent.tsx` for implementation patterns
- Use `useVoiceAgentBridge` hook for voice features
- Test with both feature flag states during development

### For Operations
- Monitor voice session success rates in Azure Application Insights
- Use feature flag to control rollout if issues arise
- Legacy system remains available for emergency fallback

### Key Benefits of Migration
1. **Better Performance**: Lower latency real-time processing
2. **Enhanced Features**: Advanced sentiment analysis, better error recovery
3. **Simplified Architecture**: Single service instead of multiple pipeline
4. **Future-Ready**: Built on Azure's latest voice AI capabilities
5. **Better Developer Experience**: Unified hook-based API

## Conclusion

The migration to Azure AI Foundry voice system provides a more robust, feature-rich voice interview experience while maintaining backward compatibility during the transition period. All new development should target the Azure AI Foundry system, with the legacy system serving as a safety net during the migration period.
