// Core agent interfaces and types
export type {
  FoundryAgent,
  AgentConfig,
  InterviewContext,
  SessionState,
  Question,
  CandidateProfile,
  CompanyInfo,
  SessionHistory
} from '../types/agent-types';

// Base agent class
export { BaseAgent } from './base-agent';

// Individual agent implementations
export { TechnicalInterviewer } from './technical-interviewer';
export { BehavioralInterviewer } from './behavioral-interviewer';
export { IndustryExpert } from './industry-expert';

// Factory and orchestration
export { AgentFactory, type AgentType, type AgentFactoryConfig } from './agent-factory';
export { 
  AgentOrchestrator,
  type InterviewPhase,
  type InterviewSessionConfig,
  type InterviewSessionResult
} from './agent-orchestrator';

/**
 * Azure AI Foundry Agent System
 * 
 * A comprehensive multi-agent interview system built on Azure AI Foundry.
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { AgentFactory, AgentOrchestrator } from '@/lib/azure-ai-foundry/agents';
 * 
 * // Create individual agents
 * const factory = AgentFactory.getInstance();
 * const technicalAgent = factory.createAgent('technical');
 * 
 * // Or run a complete interview session
 * const orchestrator = new AgentOrchestrator();
 * const config = orchestrator.createStandardSession({
 *   sessionId: 'interview-001',
 *   candidateProfile: {
 *     name: 'John Doe',
 *     experience: 'senior',
 *     skills: ['JavaScript', 'React', 'Node.js']
 *   },
 *   jobRole: 'Senior Full Stack Developer'
 * });
 * 
 * const result = await orchestrator.startSession(config);
 * console.log(`Generated ${result.allQuestions.length} questions across ${result.phaseResults.length} phases`);
 * ```
 * 
 * ## Available Agents
 * 
 * - **TechnicalInterviewer**: Specializes in coding challenges, system design, and technical problem-solving (GPT-4.5)
 * - **BehavioralInterviewer**: Focuses on soft skills, leadership potential, and cultural fit assessment (GPT-4o)  
 * - **IndustryExpert**: Evaluates industry knowledge, market awareness, and strategic thinking (Llama-4)
 * 
 * ## Architecture
 * 
 * - **BaseAgent**: Abstract base class providing common functionality
 * - **AgentFactory**: Factory pattern for creating and caching agent instances
 * - **AgentOrchestrator**: Manages multi-phase interview sessions with progress tracking
 * - **FoundryClientBase**: Handles Azure AI Foundry API communication with cost/usage tracking
 * 
 * ## Features
 * 
 * - ✅ Multi-model support (GPT-4.5, GPT-4o, Llama-4)
 * - ✅ Intelligent fallback questions when API calls fail
 * - ✅ Session state management and progress tracking
 * - ✅ Cost and usage monitoring
 * - ✅ Configurable interview phases and agent parameters
 * - ✅ Industry-specific question generation
 * - ✅ Experience level adaptation
 * - ✅ Comprehensive test coverage
 */
