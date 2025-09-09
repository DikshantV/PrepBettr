#!/usr/bin/env ts-node

/**
 * Legacy OpenAI Usage Inventory Script
 * 
 * Scans the codebase for legacy OpenAI usage patterns and creates a detailed inventory.
 * This inventory will be used for automated migration to Azure AI Foundry.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface UsagePattern {
  pattern: string;
  type: 'import' | 'instantiation' | 'model-string' | 'method-call' | 'docs-tests';
  description: string;
}

interface FileMatch {
  file: string;
  line: number;
  content: string;
  type: UsagePattern['type'];
  confidence: 'high' | 'medium' | 'low';
}

interface InventoryResult {
  timestamp: string;
  totalFiles: number;
  totalMatches: number;
  patterns: UsagePattern[];
  matches: FileMatch[];
  filesSummary: Record<string, number>;
  typesSummary: Record<string, number>;
}

class OpenAIInventory {
  private projectRoot = process.cwd();
  private patterns: UsagePattern[] = [
    {
      pattern: "from ['\"]openai['\"]",
      type: 'import',
      description: 'Direct OpenAI SDK import'
    },
    {
      pattern: "import.*openai",
      type: 'import', 
      description: 'OpenAI import variations'
    },
    {
      pattern: "from ['\"]@azure/openai['\"]",
      type: 'import',
      description: 'Azure OpenAI SDK import'
    },
    {
      pattern: "import.*@azure/openai",
      type: 'import',
      description: 'Azure OpenAI import variations'
    },
    {
      pattern: "new OpenAI\\(",
      type: 'instantiation',
      description: 'OpenAI client instantiation'
    },
    {
      pattern: "new OpenAIClient\\(",
      type: 'instantiation',
      description: 'Azure OpenAI client instantiation'
    },
    {
      pattern: "gpt-3\\.5",
      type: 'model-string',
      description: 'GPT-3.5 model references'
    },
    {
      pattern: "gpt-35-turbo",
      type: 'model-string', 
      description: 'GPT-3.5 turbo model references'
    },
    {
      pattern: "gpt-4(?!o)",
      type: 'model-string',
      description: 'GPT-4 model references (not 4o)'
    },
    {
      pattern: "\\.chat\\.completions\\.create",
      type: 'method-call',
      description: 'Chat completion API calls'
    },
    {
      pattern: "\\.completions\\.create",
      type: 'method-call',
      description: 'Text completion API calls'
    },
    {
      pattern: "createChatCompletion",
      type: 'method-call',
      description: 'Legacy chat completion method'
    },
    {
      pattern: "createCompletion",
      type: 'method-call',
      description: 'Legacy completion method'
    }
  ];

  async generateInventory(): Promise<InventoryResult> {
    console.log('🔍 Scanning codebase for legacy OpenAI usage...');
    
    const matches: FileMatch[] = [];
    const excludePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build', 
      '.next',
      'coverage',
      '*.log',
      'scripts/migration' // Don't scan our own migration scripts
    ];

    for (const pattern of this.patterns) {
      console.log(`  Searching for: ${pattern.description}`);
      
      try {
        // Use ripgrep for fast searching, fallback to grep
        let grepCommand: string;
        try {
          // Test if ripgrep is available
          execSync('which rg', { stdio: 'ignore' });
          grepCommand = `rg --line-number --no-heading "${pattern.pattern}" --type typescript --type javascript --type tsx --type jsx`;
        } catch {
          // Fallback to standard grep
          const excludeArgs = excludePatterns.map(p => `--exclude-dir=${p}`).join(' ');
          grepCommand = `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${excludeArgs} "${pattern.pattern}" .`;
        }
        
        const output = execSync(grepCommand, { 
          cwd: this.projectRoot,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'] // Ignore stderr to suppress no-match messages
        }).toString();

        const lines = output.trim().split('\n').filter(line => line.length > 0);
        
        for (const line of lines) {
          const match = this.parseGrepOutput(line, pattern);
          if (match) {
            matches.push(match);
          }
        }
      } catch (error) {
        // No matches found, continue with next pattern
        console.log(`    No matches found for pattern: ${pattern.pattern}`);
      }
    }

    // Generate summary statistics
    const filesSummary: Record<string, number> = {};
    const typesSummary: Record<string, number> = {};

    matches.forEach(match => {
      filesSummary[match.file] = (filesSummary[match.file] || 0) + 1;
      typesSummary[match.type] = (typesSummary[match.type] || 0) + 1;
    });

    const result: InventoryResult = {
      timestamp: new Date().toISOString(),
      totalFiles: Object.keys(filesSummary).length,
      totalMatches: matches.length,
      patterns: this.patterns,
      matches: matches.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
      filesSummary,
      typesSummary
    };

    return result;
  }

  private parseGrepOutput(line: string, pattern: UsagePattern): FileMatch | null {
    // Handle ripgrep and grep output formats
    let match: RegExpMatchArray | null;
    
    // Try ripgrep format: file:line:content
    match = line.match(/^([^:]+):(\d+):(.*)$/);
    
    if (!match) {
      // Try grep format: file:line:content  
      match = line.match(/^([^:]+):(\d+):(.*)$/);
    }

    if (!match) return null;

    const [, file, lineNum, content] = match;
    
    // Skip if it's in an excluded directory
    if (file.includes('node_modules') || file.includes('.git') || file.includes('migration')) {
      return null;
    }

    // Determine confidence based on context
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    
    if (pattern.type === 'import' && content.trim().startsWith('import')) {
      confidence = 'high';
    } else if (pattern.type === 'instantiation' && content.includes('new ')) {
      confidence = 'high';  
    } else if (pattern.type === 'model-string' && (content.includes('"') || content.includes("'"))) {
      confidence = 'high';
    } else if (content.includes('//') || content.includes('*') || content.includes('test')) {
      confidence = 'low'; // Comments or tests
    }

    return {
      file: path.relative(this.projectRoot, file),
      line: parseInt(lineNum),
      content: content.trim(),
      type: pattern.type,
      confidence
    };
  }

  async saveInventory(inventory: InventoryResult): Promise<void> {
    const outputPath = path.join(this.projectRoot, 'scripts/migration/openai-inventory.json');
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write pretty-printed JSON
    fs.writeFileSync(outputPath, JSON.stringify(inventory, null, 2));
    console.log(`📋 Inventory saved to: ${path.relative(this.projectRoot, outputPath)}`);
  }

  printSummary(inventory: InventoryResult): void {
    console.log('\n📊 OpenAI Usage Inventory Summary');
    console.log('=====================================');
    console.log(`Total files affected: ${inventory.totalFiles}`);
    console.log(`Total matches found: ${inventory.totalMatches}`);
    
    console.log('\n📁 Files by match count:');
    const sortedFiles = Object.entries(inventory.filesSummary)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10); // Top 10
    
    sortedFiles.forEach(([file, count]) => {
      console.log(`  ${file}: ${count} matches`);
    });

    console.log('\n🏷️  Usage types:');
    Object.entries(inventory.typesSummary).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} matches`);
    });

    console.log('\n🎯 High-confidence matches for review:');
    const highConfidenceMatches = inventory.matches.filter(m => m.confidence === 'high');
    highConfidenceMatches.slice(0, 5).forEach(match => {
      console.log(`  ${match.file}:${match.line} (${match.type})`);
      console.log(`    ${match.content.substring(0, 80)}...`);
    });
  }
}

// Execute if run directly
if (require.main === module) {
  (async () => {
    try {
      const inventory = new OpenAIInventory();
      const result = await inventory.generateInventory();
      
      inventory.printSummary(result);
      await inventory.saveInventory(result);
      
      console.log('\n✅ Inventory generation complete!');
      console.log('Next step: Review the inventory and run the migration scripts');
      
    } catch (error) {
      console.error('❌ Failed to generate inventory:', error);
      process.exit(1);
    }
  })();
}

export { OpenAIInventory, type InventoryResult, type FileMatch };
