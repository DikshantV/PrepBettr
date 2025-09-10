import { FoundryAgent } from '../types/agent-types';
import { TechnicalInterviewer } from './technical-interviewer';
import { BehavioralInterviewer } from './behavioral-interviewer';
import { IndustryExpert } from './industry-expert';

/**
 * Available agent types in the system
 */
export type AgentType = 'technical' | 'behavioral' | 'industry';

/**
 * Configuration options for agent creation
 */
export interface AgentFactoryConfig {
  /** Override default model for the agent */
  model?: string;
  /** Override default temperature */
  temperature?: number;
  /** Override default max tokens */
  maxTokens?: number;
  /** Custom system instructions to append or replace */
  customInstructions?: string;
  /** Whether to replace or append custom instructions */
  instructionsMode?: 'replace' | 'append';
}

/**
 * Factory class for creating and managing interview agents
 * 
 * Implements the Factory pattern to provide a centralized way to create
 * different types of interview agents with optional configuration overrides.
 */
export class AgentFactory {
  private static instance: AgentFactory;
  private agentInstances: Map<string, FoundryAgent> = new Map();

  /**
   * Get singleton instance of AgentFactory
   */
  public static getInstance(): AgentFactory {
    if (!AgentFactory.instance) {
      AgentFactory.instance = new AgentFactory();
    }
    return AgentFactory.instance;
  }

  /**
   * Create an agent instance of the specified type
   * 
   * @param type - The type of agent to create
   * @param config - Optional configuration overrides
   * @returns The created agent instance
   */
  public createAgent(type: AgentType, config?: AgentFactoryConfig): FoundryAgent {
    const cacheKey = `${type}-${this.getConfigHash(config)}`;
    
    // Return cached instance if available
    if (this.agentInstances.has(cacheKey)) {
      return this.agentInstances.get(cacheKey)!;
    }

    let agent: FoundryAgent;

    // Create agent based on type
    switch (type) {
      case 'technical':
        agent = new TechnicalInterviewer();
        break;
      case 'behavioral':
        agent = new BehavioralInterviewer();
        break;
      case 'industry':
        agent = new IndustryExpert();
        break;
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }

    // Apply configuration overrides if provided
    if (config) {
      agent = this.applyConfigOverrides(agent, config);
    }

    // Cache the instance
    this.agentInstances.set(cacheKey, agent);
    
    return agent;
  }

  /**
   * Create multiple agents at once
   * 
   * @param specs - Array of agent specifications with type and optional config
   * @returns Array of created agent instances
   */
  public createAgents(specs: Array<{ type: AgentType; config?: AgentFactoryConfig }>): FoundryAgent[] {
    return specs.map(spec => this.createAgent(spec.type, spec.config));
  }

  /**
   * Get all available agent types
   */
  public getAvailableTypes(): AgentType[] {
    return ['technical', 'behavioral', 'industry'];
  }

  /**
   * Create a default interview agent set (one of each type)
   * 
   * @param globalConfig - Global configuration to apply to all agents
   * @returns Object containing all three agent types
   */
  public createDefaultSet(globalConfig?: AgentFactoryConfig): {
    technical: FoundryAgent;
    behavioral: FoundryAgent;
    industry: FoundryAgent;
  } {
    return {
      technical: this.createAgent('technical', globalConfig),
      behavioral: this.createAgent('behavioral', globalConfig),
      industry: this.createAgent('industry', globalConfig)
    };
  }

  /**
   * Create agents based on interview requirements
   * 
   * @param requirements - Interview requirements specification
   * @returns Array of appropriate agents for the requirements
   */
  public createAgentsForRequirements(requirements: {
    includeTechnical?: boolean;
    includeBehavioral?: boolean;
    includeIndustry?: boolean;
    experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
    industry?: string;
    roleType?: 'individual-contributor' | 'management' | 'leadership';
  }): FoundryAgent[] {
    const agents: FoundryAgent[] = [];

    // Always include technical for technical roles
    if (requirements.includeTechnical !== false) {
      const techConfig: AgentFactoryConfig = {};
      
      // Adjust technical difficulty based on experience level
      if (requirements.experienceLevel === 'entry') {
        techConfig.temperature = 0.3; // More predictable, foundational questions
      } else if (requirements.experienceLevel === 'senior' || requirements.experienceLevel === 'executive') {
        techConfig.temperature = 0.7; // More complex, system design focused
      }
      
      agents.push(this.createAgent('technical', techConfig));
    }

    // Include behavioral for management and senior roles
    if (requirements.includeBehavioral !== false) {
      const behavioralConfig: AgentFactoryConfig = {};
      
      // Adjust behavioral focus based on role type
      if (requirements.roleType === 'management' || requirements.roleType === 'leadership') {
        behavioralConfig.customInstructions = '\n\nFOCUS ON LEADERSHIP: Emphasize leadership scenarios, team management, strategic decision-making, and organizational impact.';
        behavioralConfig.instructionsMode = 'append';
      }
      
      agents.push(this.createAgent('behavioral', behavioralConfig));
    }

    // Include industry expert for senior roles and specific industries
    if (requirements.includeIndustry !== false && 
        (requirements.experienceLevel === 'senior' || requirements.experienceLevel === 'executive' || requirements.industry)) {
      const industryConfig: AgentFactoryConfig = {};
      
      if (requirements.industry) {
        industryConfig.customInstructions = `\n\nINDUSTRY FOCUS: Prioritize questions specific to the ${requirements.industry} industry, including sector-specific regulations, competitive dynamics, and emerging trends.`;
        industryConfig.instructionsMode = 'append';
      }
      
      agents.push(this.createAgent('industry', industryConfig));
    }

    return agents;
  }

  /**
   * Clear cached agent instances (useful for testing or configuration changes)
   */
  public clearCache(): void {
    this.agentInstances.clear();
  }

  /**
   * Get information about a specific agent type
   */
  public getAgentInfo(type: AgentType): {
    type: AgentType;
    name: string;
    description: string;
    defaultModel: string;
    capabilities: string[];
  } {
    const agentInfo = {
      technical: {
        type: 'technical' as AgentType,
        name: 'Technical Interviewer',
        description: 'Specializes in coding challenges, system design, and technical problem-solving assessment',
        defaultModel: 'gpt-4.5',
        capabilities: [
          'Coding problems and algorithms',
          'System design and architecture',
          'Technology stack assessment',
          'Problem-solving methodology',
          'Code review and best practices'
        ]
      },
      behavioral: {
        type: 'behavioral' as AgentType,
        name: 'Behavioral Interviewer',
        description: 'Focuses on soft skills, leadership potential, and cultural fit assessment',
        defaultModel: 'gpt-4o',
        capabilities: [
          'STAR method behavioral questions',
          'Leadership and teamwork assessment',
          'Conflict resolution scenarios',
          'Communication skills evaluation',
          'Cultural fit and motivation'
        ]
      },
      industry: {
        type: 'industry' as AgentType,
        name: 'Industry Expert',
        description: 'Evaluates industry knowledge, market awareness, and strategic thinking',
        defaultModel: 'llama-4',
        capabilities: [
          'Industry trends and insights',
          'Regulatory and compliance knowledge',
          'Competitive landscape analysis',
          'Business strategy evaluation',
          'Market dynamics understanding'
        ]
      }
    };

    return agentInfo[type];
  }

  /**
   * Apply configuration overrides to an agent
   * Note: This is a simplified implementation. In a real scenario, you might
   * need to create a new instance with the overrides applied at construction time.
   */
  private applyConfigOverrides(agent: FoundryAgent, config: AgentFactoryConfig): FoundryAgent {
    // For now, we return the agent as-is since our BaseAgent doesn't support
    // runtime configuration changes. In a full implementation, you would either:
    // 1. Make agent configurations mutable
    // 2. Create a wrapper/decorator pattern
    // 3. Recreate the agent with new config
    
    // This is a placeholder for the concept
    console.log(`Applied config overrides to agent:`, config);
    return agent;
  }

  /**
   * Generate a hash for configuration to use in caching
   */
  private getConfigHash(config?: AgentFactoryConfig): string {
    if (!config) return 'default';
    return JSON.stringify(config);
  }
}
