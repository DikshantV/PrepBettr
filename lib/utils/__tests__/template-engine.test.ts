/**
 * Template Engine Unit Tests
 * 
 * Tests for variable interpolation, conditional logic, loops, helper functions,
 * YAML template loading, and error handling.
 */

import { templateEngine, createTemplateEngine, renderTemplate } from '../template-engine';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs for testing
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Template Engine', () => {
  beforeEach(() => {
    // Clear cache before each test
    templateEngine.clearCache();
    jest.clearAllMocks();
  });

  describe('Variable Interpolation', () => {
    test('should interpolate simple variables', () => {
      const template = 'Hello {{name}}!';
      const context = { name: 'World' };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Hello World!');
    });

    test('should interpolate nested object properties', () => {
      const template = 'Welcome {{user.profile.name}}';
      const context = { user: { profile: { name: 'John Doe' } } };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Welcome John Doe');
    });

    test('should handle missing variables gracefully', () => {
      const template = 'Hello {{missing}}!';
      const context = {};
      const result = templateEngine.render(template, context);
      expect(result).toBe('Hello !');
    });

    test('should handle null and undefined values', () => {
      const template = 'Value: {{value}}';
      const context = { value: null };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Value: ');
    });

    test('should interpolate numbers and booleans', () => {
      const template = 'Count: {{count}}, Active: {{active}}';
      const context = { count: 42, active: true };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Count: 42, Active: true');
    });
  });

  describe('Conditional Logic', () => {
    test('should render conditional blocks when condition is true', () => {
      const template = '{{#if showMessage}}Hello World!{{/if}}';
      const context = { showMessage: true };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Hello World!');
    });

    test('should not render conditional blocks when condition is false', () => {
      const template = '{{#if showMessage}}Hello World!{{/if}}';
      const context = { showMessage: false };
      const result = templateEngine.render(template, context);
      expect(result).toBe('');
    });

    test('should handle nested object conditionals', () => {
      const template = '{{#if user.isActive}}User is active{{/if}}';
      const context = { user: { isActive: true } };
      const result = templateEngine.render(template, context);
      expect(result).toBe('User is active');
    });

    test('should handle comparison operators', () => {
      const template = '{{#if age > 18}}Adult{{/if}}';
      const context = { age: 25 };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Adult');
    });

    test('should handle equality comparisons', () => {
      const template = '{{#if status === "active"}}Status is active{{/if}}';
      const context = { status: 'active' };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Status is active');
    });

    test('should handle multiple conditional blocks', () => {
      const template = '{{#if isAdmin}}Admin{{/if}}{{#if isMember}}Member{{/if}}';
      const context = { isAdmin: false, isMember: true };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Member');
    });
  });

  describe('Loop Blocks', () => {
    test('should iterate over arrays', () => {
      const template = '{{#each items}}{{@value}} {{/each}}';
      const context = { items: ['a', 'b', 'c'] };
      const result = templateEngine.render(template, context);
      expect(result).toBe('a b c ');
    });

    test('should iterate over object arrays', () => {
      const template = '{{#each users}}{{name}} {{/each}}';
      const context = { 
        users: [
          { name: 'John' },
          { name: 'Jane' }
        ]
      };
      const result = templateEngine.render(template, context);
      expect(result).toBe('John Jane ');
    });

    test('should provide loop metadata', () => {
      const template = '{{#each items}}{{@index}}: {{@value}}{{#if @first}} (first){{/if}}{{#if @last}} (last){{/if}} {{/each}}';
      const context = { items: ['a', 'b'] };
      const result = templateEngine.render(template, context);
      expect(result).toBe('0: a (first) 1: b (last) ');
    });

    test('should handle empty arrays', () => {
      const template = '{{#each items}}{{@value}}{{/each}}No items';
      const context = { items: [] };
      const result = templateEngine.render(template, context);
      expect(result).toBe('No items');
    });

    test('should handle nested loops', () => {
      const template = '{{#each categories}}{{name}}: {{#each items}}{{@value}} {{/each}}{{/each}}';
      const context = {
        categories: [
          { name: 'Fruits', items: ['apple', 'banana'] },
          { name: 'Colors', items: ['red', 'blue'] }
        ]
      };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Fruits: apple banana Colors: red blue ');
    });
  });

  describe('Helper Functions', () => {
    test('should use string helper functions', () => {
      const template = '{{uppercase(name)}} - {{lowercase(name)}} - {{capitalize(name)}}';
      const context = { name: 'john DOE' };
      const result = templateEngine.render(template, context);
      expect(result).toBe('JOHN DOE - john doe - John doe');
    });

    test('should use array helper functions', () => {
      const template = 'Length: {{length(items)}}, First: {{first(items)}}, Last: {{last(items)}}';
      const context = { items: ['a', 'b', 'c'] };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Length: 3, First: a, Last: c');
    });

    test('should use join helper', () => {
      const template = 'Items: {{join(items, " | ")}}';
      const context = { items: ['apple', 'banana', 'cherry'] };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Items: apple | banana | cherry');
    });

    test('should use default helper', () => {
      const template = 'Name: {{default(name, "Unknown")}}';
      const context = { name: null };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Name: Unknown');
    });

    test('should use comparison helpers', () => {
      const template = 'Equal: {{eq(a, b)}}, Greater: {{gt(a, b)}}';
      const context = { a: 5, b: 3 };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Equal: false, Greater: true');
    });

    test('should use pluralize helper', () => {
      const template = '{{pluralize(count, "item", "items")}}';
      expect(templateEngine.render(template, { count: 1 })).toBe('item');
      expect(templateEngine.render(template, { count: 2 })).toBe('items');
    });

    test('should use increment helper', () => {
      const template = 'Question {{increment(@index)}}:';
      const context = { '@index': 0 };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Question 1:');
    });

    test('should handle helper function errors gracefully', () => {
      const template = '{{unknown_helper(value)}}';
      const context = { value: 'test' };
      const result = templateEngine.render(template, context);
      expect(result).toBe('{{unknown_helper(value)}}'); // Should return original expression
    });
  });

  describe('Custom Helper Registration', () => {
    test('should register and use custom helpers', () => {
      const customEngine = createTemplateEngine();
      customEngine.registerHelper('reverse', (str: string) => str.split('').reverse().join(''));
      
      const template = '{{reverse(text)}}';
      const context = { text: 'hello' };
      const result = customEngine.render(template, context);
      expect(result).toBe('olleh');
    });

    test('should register helpers with multiple parameters', () => {
      const customEngine = createTemplateEngine();
      customEngine.registerHelper('multiply', (a: number, b: number) => String(a * b));
      
      const template = '{{multiply(x, y)}}';
      const context = { x: 3, y: 4 };
      const result = customEngine.render(template, context);
      expect(result).toBe('12');
    });
  });

  describe('YAML Template Loading', () => {
    test('should load template from YAML file', () => {
      const yamlContent = `
name: "test-template"
description: "Test template"
template: "Hello {{name}}!"
variables:
  name: "World"
`;
      mockFs.readFileSync.mockReturnValue(yamlContent);
      
      const templatePath = '/test/template.yaml';
      const template = templateEngine.loadTemplate(templatePath);
      
      expect(template.name).toBe('test-template');
      expect(template.description).toBe('Test template');
      expect(template.template).toBe('Hello {{name}}!');
      expect(template.variables).toEqual({ name: 'World' });
    });

    test('should render from loaded template config', () => {
      const yamlContent = `
name: "greeting-template"
template: "Hello {{name}}!"
variables:
  name: "World"
`;
      mockFs.readFileSync.mockReturnValue(yamlContent);
      
      const templatePath = '/test/greeting.yaml';
      const config = templateEngine.loadTemplate(templatePath);
      const result = templateEngine.renderFromConfig(config, { name: 'User' });
      
      expect(result).toBe('Hello User!'); // Context overrides template variables
    });

    test('should cache loaded templates', () => {
      const yamlContent = `
name: "cached-template"
template: "Cached {{value}}"
`;
      mockFs.readFileSync.mockReturnValue(yamlContent);
      
      const templatePath = '/test/cached.yaml';
      
      // First load
      templateEngine.loadTemplate(templatePath);
      // Second load (should use cache)
      templateEngine.loadTemplate(templatePath);
      
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    test('should load template set from directory', () => {
      const files = ['template1.yaml', 'template2.yml', 'readme.txt'];
      mockFs.readdirSync.mockReturnValue(files as any);
      
      mockFs.readFileSync
        .mockReturnValueOnce('name: "template1"\ntemplate: "Template 1"')
        .mockReturnValueOnce('name: "template2"\ntemplate: "Template 2"');
      
      const templates = templateEngine.loadTemplateSet('/test/templates');
      
      expect(Object.keys(templates)).toEqual(['template1', 'template2']);
      expect(templates.template1.template).toBe('Template 1');
      expect(templates.template2.template).toBe('Template 2');
    });

    test('should handle invalid YAML gracefully', () => {
      mockFs.readFileSync.mockReturnValue('invalid: yaml: content:');
      
      expect(() => {
        templateEngine.loadTemplate('/test/invalid.yaml');
      }).toThrow('Failed to load template from /test/invalid.yaml');
    });

    test('should validate template config', () => {
      mockFs.readFileSync.mockReturnValue('name: "no-template"\ndescription: "Missing template field"');
      
      expect(() => {
        templateEngine.loadTemplate('/test/no-template.yaml');
      }).toThrow('Template config must have a "template" field');
    });
  });

  describe('Complex Template Scenarios', () => {
    test('should handle combined conditionals and loops', () => {
      const template = `
{{#if showItems}}
Items:
{{#each items}}
  - {{name}}{{#if isActive}} (active){{/if}}
{{/each}}
{{/if}}
`;
      const context = {
        showItems: true,
        items: [
          { name: 'Item 1', isActive: true },
          { name: 'Item 2', isActive: false },
          { name: 'Item 3', isActive: true }
        ]
      };
      const result = templateEngine.render(template, context);
      expect(result.trim()).toContain('Item 1 (active)');
      expect(result.trim()).toContain('Item 2');
      expect(result.trim()).toContain('Item 3 (active)');
    });

    test('should handle nested conditionals', () => {
      const template = '{{#if user}}{{#if user.isAdmin}}Admin: {{user.name}}{{/if}}{{/if}}';
      const context = { user: { name: 'John', isAdmin: true } };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Admin: John');
    });

    test('should handle helper functions in loops', () => {
      const template = '{{#each items}}{{increment(@index)}}: {{uppercase(name)}} {{/each}}';
      const context = { items: [{ name: 'apple' }, { name: 'banana' }] };
      const result = templateEngine.render(template, context);
      expect(result).toBe('1: APPLE 2: BANANA ');
    });

    test('should handle complex nested data structures', () => {
      const template = `
{{#each departments}}
Department: {{name}}
{{#each employees}}
  - {{profile.firstName}} {{profile.lastName}} ({{role}})
  {{#if skills}}Skills: {{join(skills, ", ")}}{{/if}}
{{/each}}
{{/each}}
`;
      const context = {
        departments: [
          {
            name: 'Engineering',
            employees: [
              {
                profile: { firstName: 'John', lastName: 'Doe' },
                role: 'Developer',
                skills: ['JavaScript', 'React']
              }
            ]
          }
        ]
      };
      const result = templateEngine.render(template, context);
      expect(result).toContain('Department: Engineering');
      expect(result).toContain('John Doe (Developer)');
      expect(result).toContain('Skills: JavaScript, React');
    });
  });

  describe('Error Handling', () => {
    test('should handle rendering errors gracefully', () => {
      // Test with a template that would cause an error during processing
      const invalidTemplate = '{{helper_that_throws()}}';
      const context = {};
      
      // Register a helper that throws an error
      const customEngine = createTemplateEngine();
      customEngine.registerHelper('helper_that_throws', () => {
        throw new Error('Test error');
      });
      
      // The template should render with the original expression when helper fails
      const result = customEngine.render(invalidTemplate, context);
      expect(result).toBe('{{helper_that_throws()}}');
    });

    test('should handle file loading errors', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      expect(() => {
        templateEngine.loadTemplate('/nonexistent/template.yaml');
      }).toThrow('Failed to load template from /nonexistent/template.yaml: File not found');
    });

    test('should handle directory loading errors', () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Directory not found');
      });
      
      expect(() => {
        templateEngine.loadTemplateSet('/nonexistent/directory');
      }).toThrow('Failed to load templates from /nonexistent/directory: Directory not found');
    });

    test('should return original expression on interpolation errors', () => {
      const template = '{{very.deeply.nested.property.that.does.not.exist}}';
      const context = {};
      const result = templateEngine.render(template, context);
      expect(result).toBe('');
    });
  });

  describe('Cache Management', () => {
    test('should track cache statistics', () => {
      const yamlContent = 'name: "test"\ntemplate: "Hello"';
      mockFs.readFileSync.mockReturnValue(yamlContent);
      
      // Load a template
      templateEngine.loadTemplate('/test/template1.yaml');
      templateEngine.loadTemplate('/test/template2.yaml');
      
      const stats = templateEngine.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.keys.length).toBe(2);
    });

    test('should clear cache', () => {
      const yamlContent = 'name: "test"\ntemplate: "Hello"';
      mockFs.readFileSync.mockReturnValue(yamlContent);
      
      // Load template
      templateEngine.loadTemplate('/test/template.yaml');
      expect(templateEngine.getCacheStats().size).toBe(1);
      
      // Clear cache
      templateEngine.clearCache();
      expect(templateEngine.getCacheStats().size).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    test('should provide renderTemplate utility function', () => {
      const result = renderTemplate('Hello {{name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    test('should create independent template engines', () => {
      const engine1 = createTemplateEngine();
      const engine2 = createTemplateEngine();
      
      engine1.registerHelper('custom1', () => 'Engine 1');
      engine2.registerHelper('custom2', () => 'Engine 2');
      
      const result1 = engine1.render('{{custom1()}}', {});
      const result2 = engine2.render('{{custom2()}}', {});
      
      expect(result1).toBe('Engine 1');
      expect(result2).toBe('Engine 2');
    });
  });

  describe('Performance Considerations', () => {
    test('should handle large templates efficiently', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      const template = '{{#each items}}{{id}}: {{name}} {{/each}}';
      const context = { items: largeArray };
      
      const startTime = Date.now();
      const result = templateEngine.render(template, context);
      const endTime = Date.now();
      
      expect(result).toContain('0: Item 0');
      expect(result).toContain('999: Item 999');
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle deeply nested objects', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'Deep Value'
                }
              }
            }
          }
        }
      };
      
      const template = '{{level1.level2.level3.level4.level5.value}}';
      const result = templateEngine.render(template, deepObject);
      expect(result).toBe('Deep Value');
    });
  });
});
