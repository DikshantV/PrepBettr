/**
 * Dynamic Template Engine for PrepBettr
 * 
 * Provides advanced template processing with variable interpolation, 
 * conditional rendering, loops, and structured YAML template support.
 * 
 * Features:
 * - Variable interpolation: {{variable}}
 * - Conditional blocks: {{#if condition}}...{{/if}}
 * - Loop blocks: {{#each items}}...{{/each}}
 * - Nested object access: {{user.profile.name}}
 * - Helper functions: {{uppercase(text)}}
 * - YAML template loading and caching
 * 
 * @version 1.0.0
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

// ===== TYPES =====

export interface TemplateContext {
  [key: string]: any;
}

export interface TemplateConfig {
  name: string;
  description?: string;
  version?: string;
  template: string;
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface TemplateEngine {
  render(template: string, context: TemplateContext): string;
  renderFromConfig(config: TemplateConfig, context: TemplateContext): string;
  loadTemplate(filePath: string): TemplateConfig;
  loadTemplateSet(directoryPath: string): Record<string, TemplateConfig>;
}

export interface HelperFunction {
  (value: any, ...args: any[]): string;
}

// ===== TEMPLATE ENGINE IMPLEMENTATION =====

class PrepBettrTemplateEngine implements TemplateEngine {
  private templateCache = new Map<string, TemplateConfig>();
  private helpers = new Map<string, HelperFunction>();

  constructor() {
    this.registerDefaultHelpers();
  }

  /**
   * Register default helper functions
   */
  private registerDefaultHelpers(): void {
    // String helpers
    this.registerHelper('uppercase', (value: string) => String(value).toUpperCase());
    this.registerHelper('lowercase', (value: string) => String(value).toLowerCase());
    this.registerHelper('capitalize', (value: string) => {
      const str = String(value);
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });
    this.registerHelper('trim', (value: string) => String(value).trim());
    
    // Array helpers
    this.registerHelper('length', (value: any[]) => String(Array.isArray(value) ? value.length : 0));
    this.registerHelper('join', (value: any[], separator = ', ') => 
      Array.isArray(value) ? value.join(separator) : String(value)
    );
    this.registerHelper('first', (value: any[]) => String(Array.isArray(value) ? value[0] : value));
    this.registerHelper('last', (value: any[]) => String(Array.isArray(value) ? value[value.length - 1] : value));
    
    // Logic helpers
    this.registerHelper('default', (value: any, defaultValue: any) => String(value || defaultValue));
    this.registerHelper('eq', (a: any, b: any) => String(a === b));
    this.registerHelper('neq', (a: any, b: any) => String(a !== b));
    this.registerHelper('gt', (a: number, b: number) => String(a > b));
    this.registerHelper('lt', (a: number, b: number) => String(a < b));
    
    // Formatting helpers
    this.registerHelper('dateFormat', (value: string | Date, format = 'YYYY-MM-DD') => {
      const date = new Date(value);
      return date.toISOString().split('T')[0]; // Basic formatting
    });
    this.registerHelper('pluralize', (count: number, singular: string, plural?: string) => {
      return count === 1 ? singular : (plural || `${singular}s`);
    });
    this.registerHelper('increment', (value: number) => String(value + 1));
  }

  /**
   * Register a custom helper function
   */
  public registerHelper(name: string, fn: HelperFunction): void {
    this.helpers.set(name, fn);
  }

  /**
   * Render a template string with context
   */
  public render(template: string, context: TemplateContext = {}): string {
    if (!template) {
      return '';
    }

    try {
      let result = template;
      let previousResult = '';
      let iterations = 0;
      const maxIterations = 10; // Prevent infinite loops in nested processing

      // Keep processing until no more changes occur or max iterations reached
      while (result !== previousResult && iterations < maxIterations) {
        previousResult = result;
        
        // Process conditional blocks first
        result = this.processConditionals(result, context);
        
        // Process loop blocks
        result = this.processLoops(result, context);
        
        // Process variable interpolations and helper functions
        result = this.processInterpolations(result, context);
        
        iterations++;
      }

      return result;
    } catch (error) {
      console.error('Template rendering error:', error);
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Render template from config with merged context
   */
  public renderFromConfig(config: TemplateConfig, context: TemplateContext = {}): string {
    const mergedContext = { ...config.variables, ...context };
    return this.render(config.template, mergedContext);
  }

  /**
   * Load template from YAML file
   */
  public loadTemplate(filePath: string): TemplateConfig {
    const cacheKey = path.resolve(filePath);
    
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const config = yaml.load(content) as TemplateConfig;
      
      if (!config.template) {
        throw new Error('Template config must have a "template" field');
      }

      this.templateCache.set(cacheKey, config);
      return config;
    } catch (error) {
      throw new Error(`Failed to load template from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load all templates from a directory
   */
  public loadTemplateSet(directoryPath: string): Record<string, TemplateConfig> {
    const templates: Record<string, TemplateConfig> = {};

    try {
      const files = fs.readdirSync(directoryPath);
      
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const filePath = path.join(directoryPath, file);
          const templateName = path.basename(file, path.extname(file));
          templates[templateName] = this.loadTemplate(filePath);
        }
      }

      return templates;
    } catch (error) {
      throw new Error(`Failed to load templates from ${directoryPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process conditional blocks: {{#if condition}}...{{/if}}
   */
  private processConditionals(template: string, context: TemplateContext): string {
    const conditionalRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return template.replace(conditionalRegex, (match, condition, content) => {
      try {
        const isTrue = this.evaluateCondition(condition.trim(), context);
        return isTrue ? content : '';
      } catch (error) {
        console.warn(`Conditional evaluation error: ${error}`);
        return '';
      }
    });
  }

  /**
   * Process loop blocks: {{#each items}}...{{/each}}
   */
  private processLoops(template: string, context: TemplateContext): string {
    const loopRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    return template.replace(loopRegex, (match, arrayPath, content) => {
      try {
        const array = this.getNestedValue(context, arrayPath.trim());
        
        if (!Array.isArray(array)) {
          return '';
        }

        return array.map((item, index) => {
          const loopContext = {
            ...context,
            '@item': item,
            '@index': index,
            '@first': index === 0,
            '@last': index === array.length - 1,
            ...(typeof item === 'object' && item !== null ? item : { '@value': item })
          };
          
          // Only process interpolations here - nested processing will be handled in main render loop
          return this.processInterpolations(content, loopContext);
        }).join('');
      } catch (error) {
        console.warn(`Loop processing error: ${error}`);
        return '';
      }
    });
  }

  /**
   * Process variable interpolations and helper functions
   */
  private processInterpolations(template: string, context: TemplateContext): string {
    const interpolationRegex = /\{\{([^}]+)\}\}/g;
    
    return template.replace(interpolationRegex, (match, expression) => {
      try {
        return this.evaluateExpression(expression.trim(), context);
      } catch (error) {
        console.warn(`Interpolation error for "${expression}": ${error}`);
        return match; // Return original expression on error
      }
    });
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string, context: TemplateContext): boolean {
    // Handle simple variable existence
    if (!condition.includes(' ')) {
      const value = this.getNestedValue(context, condition);
      return Boolean(value);
    }

    // Handle comparison operations
    const comparisonMatch = condition.match(/^([^<>=!]+)\s*([<>=!]+)\s*(.+)$/);
    if (comparisonMatch) {
      const [, left, operator, right] = comparisonMatch;
      const leftValue = this.getNestedValue(context, left.trim());
      const rightValue = this.parseValue(right.trim(), context);

      switch (operator.trim()) {
        case '===':
        case '==':
          return leftValue === rightValue;
        case '!==':
        case '!=':
          return leftValue !== rightValue;
        case '>':
          return Number(leftValue) > Number(rightValue);
        case '<':
          return Number(leftValue) < Number(rightValue);
        case '>=':
          return Number(leftValue) >= Number(rightValue);
        case '<=':
          return Number(leftValue) <= Number(rightValue);
        default:
          return Boolean(leftValue);
      }
    }

    // Fallback: evaluate as variable
    return Boolean(this.getNestedValue(context, condition));
  }

  /**
   * Evaluate an expression (variable or helper function)
   */
  private evaluateExpression(expression: string, context: TemplateContext): string {
    // Check if it's a helper function call
    const helperMatch = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)$/);
    if (helperMatch) {
      const [, helperName, argsString] = helperMatch;
      
      if (this.helpers.has(helperName)) {
        try {
          const helper = this.helpers.get(helperName)!;
          const args = this.parseArguments(argsString, context);
          const firstArg = args.length > 0 ? args[0] : undefined;
          const restArgs = args.slice(1);
          return String(helper(firstArg, ...restArgs));
        } catch (error) {
          console.warn(`Helper function '${helperName}' error:`, error);
          return `{{${expression}}}`; // Return original expression on helper error
        }
      } else {
        // Unknown helper function - return original expression
        return `{{${expression}}}`;
      }
    }

    // Regular variable interpolation
    const value = this.getNestedValue(context, expression);
    return value != null ? String(value) : '';
  }

  /**
   * Parse helper function arguments
   */
  private parseArguments(argsString: string, context: TemplateContext): any[] {
    if (!argsString.trim()) {
      return [];
    }

    return argsString.split(',').map(arg => this.parseValue(arg.trim(), context));
  }

  /**
   * Parse a value (string literal, number, variable reference)
   */
  private parseValue(value: string, context: TemplateContext): any {
    // String literal
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Number literal
    if (/^-?\d*\.?\d+$/.test(value)) {
      return Number(value);
    }

    // Boolean literal
    if (value === 'true' || value === 'false') {
      return value === 'true';
    }

    // Variable reference
    return this.getNestedValue(context, value);
  }

  /**
   * Get nested value from context (e.g., "user.profile.name")
   */
  private getNestedValue(context: TemplateContext, path: string): any {
    if (!path) {
      return undefined;
    }

    const keys = path.split('.');
    let current = context;

    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Clear template cache
   */
  public clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.templateCache.size,
      keys: Array.from(this.templateCache.keys())
    };
  }
}

// ===== EXPORTS =====

// Singleton instance
export const templateEngine = new PrepBettrTemplateEngine();

// Factory function for custom instances
export const createTemplateEngine = (): PrepBettrTemplateEngine => {
  return new PrepBettrTemplateEngine();
};


// Utility functions
export const renderTemplate = (template: string, context: TemplateContext = {}): string => {
  return templateEngine.render(template, context);
};

export const loadAndRenderTemplate = (filePath: string, context: TemplateContext = {}): string => {
  const config = templateEngine.loadTemplate(filePath);
  return templateEngine.renderFromConfig(config, context);
};
