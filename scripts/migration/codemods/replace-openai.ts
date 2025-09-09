#!/usr/bin/env ts-node

/**
 * OpenAI to Azure AI Foundry Migration Script
 * 
 * This script performs automated replacement of legacy OpenAI imports and instantiations
 * with the new Azure AI Foundry MigrationOpenAIClient.
 * 
 * Transformations:
 * 1. Replace OpenAI imports with MigrationOpenAIClient
 * 2. Replace OpenAI instantiation with MigrationOpenAIClient instantiation
 * 3. Update model string references where possible
 * 4. Add initialization calls where needed
 */

import fs from 'fs';
import path from 'path';
import { InventoryResult } from '../create-inventory';

interface TransformResult {
  file: string;
  changes: string[];
  content: string;
  success: boolean;
  error?: string;
}

class OpenAIMigrator {
  private projectRoot = process.cwd();
  private results: TransformResult[] = [];

  /**
   * Run migration on all identified files
   */
  async migrate(): Promise<void> {
    console.log('🔄 Starting OpenAI to Azure AI Foundry migration...');
    
    // Load inventory
    const inventoryPath = path.join(this.projectRoot, 'scripts/migration/openai-inventory.json');
    if (!fs.existsSync(inventoryPath)) {
      throw new Error('Inventory file not found. Please run create-inventory.ts first.');
    }

    const inventory: InventoryResult = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8'));
    console.log(`📋 Loaded inventory with ${inventory.totalFiles} files and ${inventory.totalMatches} matches`);

    // Get unique files that need migration
    const filesToMigrate = new Set(inventory.matches.map(match => match.file));
    console.log(`📁 Files to migrate: ${filesToMigrate.size}`);

    // Process each file
    for (const relativePath of filesToMigrate) {
      if (this.shouldSkipFile(relativePath)) {
        console.log(`⏭️  Skipping ${relativePath} (excluded from migration)`);
        continue;
      }

      await this.migrateFile(relativePath, inventory);
    }

    this.printSummary();
  }

  /**
   * Migrate a single file
   */
  private async migrateFile(relativePath: string, inventory: InventoryResult): Promise<void> {
    const fullPath = path.join(this.projectRoot, relativePath);
    
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  File not found: ${relativePath}`);
      return;
    }

    console.log(`🔧 Migrating ${relativePath}...`);
    
    try {
      const originalContent = fs.readFileSync(fullPath, 'utf-8');
      const fileMatches = inventory.matches.filter(match => match.file === relativePath);
      
      let newContent = originalContent;
      const changes: string[] = [];

      // Apply transformations in order
      newContent = this.transformImports(newContent, fileMatches, changes);
      newContent = this.transformInstantiations(newContent, fileMatches, changes);
      newContent = this.transformModelStrings(newContent, fileMatches, changes);
      newContent = this.addInitializationCalls(newContent, changes);

      if (changes.length > 0) {
        // Create backup
        const backupPath = `${fullPath}.backup-${Date.now()}`;
        fs.writeFileSync(backupPath, originalContent);
        
        // Write new content
        fs.writeFileSync(fullPath, newContent);
        
        this.results.push({
          file: relativePath,
          changes,
          content: newContent,
          success: true
        });

        console.log(`✅ Migrated ${relativePath} (${changes.length} changes, backup: ${path.basename(backupPath)})`);
        changes.forEach(change => console.log(`    → ${change}`));
      } else {
        console.log(`➖ No changes needed for ${relativePath}`);
        this.results.push({
          file: relativePath,
          changes: [],
          content: newContent,
          success: true
        });
      }

    } catch (error: any) {
      console.error(`❌ Failed to migrate ${relativePath}:`, error.message);
      this.results.push({
        file: relativePath,
        changes: [],
        content: '',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Transform import statements
   */
  private transformImports(content: string, matches: any[], changes: string[]): string {
    const importMatches = matches.filter(match => match.type === 'import');
    let newContent = content;

    // Replace OpenAI imports
    const openaiImportPattern = /import\s+(?:\{[^}]*\}\s*,?\s*)?OpenAI(?:\s*,\s*\{[^}]*\})?\s+from\s+['"']openai['"];?/g;
    if (openaiImportPattern.test(content)) {
      newContent = newContent.replace(
        openaiImportPattern,
        "import { MigrationOpenAIClient as OpenAI } from '@/lib/azure-ai-foundry/clients/migration-wrapper';"
      );
      changes.push('Replace OpenAI import with MigrationOpenAIClient');
    }

    // Replace Azure OpenAI imports
    const azureOpenaiImportPattern = /import\s+\{[^}]*OpenAIClient[^}]*\}\s+from\s+['"']@azure\/openai['"];?/g;
    if (azureOpenaiImportPattern.test(content)) {
      newContent = newContent.replace(
        azureOpenaiImportPattern,
        "import { MigrationOpenAIClient as OpenAIClient } from '@/lib/azure-ai-foundry/clients/migration-wrapper';"
      );
      changes.push('Replace @azure/openai import with MigrationOpenAIClient');
    }

    // Handle specific service imports (like azure-openai-service)
    const serviceImportPattern = /import\s+\{[^}]*azureOpenAI[^}]*\}\s+from\s+['"'][^'"]*azure-openai[^'"]*['"];?/g;
    if (serviceImportPattern.test(content)) {
      // Keep existing service imports for now, but add foundry import
      if (!content.includes('@/lib/azure-ai-foundry/clients/migration-wrapper')) {
        const firstImport = content.search(/^import/m);
        if (firstImport !== -1) {
          const insertPoint = content.indexOf('\n', firstImport) + 1;
          newContent = newContent.slice(0, insertPoint) + 
            "import { migrationOpenAIClient } from '@/lib/azure-ai-foundry/clients/migration-wrapper';\n" +
            newContent.slice(insertPoint);
          changes.push('Add MigrationOpenAIClient import');
        }
      }
    }

    return newContent;
  }

  /**
   * Transform instantiation calls
   */
  private transformInstantiations(content: string, matches: any[], changes: string[]): string {
    let newContent = content;

    // Replace new OpenAI() calls
    const openaiNewPattern = /new\s+OpenAI\s*\(\s*\{[^}]*\}\s*\)/g;
    if (openaiNewPattern.test(content)) {
      newContent = newContent.replace(openaiNewPattern, 'new OpenAI()');
      changes.push('Replace new OpenAI({...}) with new OpenAI() (config now handled internally)');
    }

    // Replace new OpenAIClient() calls
    const openaiClientNewPattern = /new\s+OpenAIClient\s*\([^)]*\)/g;
    if (openaiClientNewPattern.test(content)) {
      newContent = newContent.replace(openaiClientNewPattern, 'new OpenAIClient()');
      changes.push('Replace new OpenAIClient(...) with new OpenAIClient() (config now handled internally)');
    }

    return newContent;
  }

  /**
   * Transform model string references
   */
  private transformModelStrings(content: string, matches: any[], changes: string[]): string {
    let newContent = content;
    
    const modelMatches = matches.filter(match => match.type === 'model-string' && match.confidence === 'high');
    
    for (const match of modelMatches) {
      // Only replace simple string literals, not dynamic or complex expressions
      if (match.content.includes("'gpt-35-turbo'") || match.content.includes('"gpt-35-turbo"')) {
        newContent = newContent.replace(/(['"])gpt-35-turbo\1/g, "$1gpt-4o$1");
        changes.push('Upgrade gpt-35-turbo model references to gpt-4o');
      }
      
      if (match.content.includes("'gpt-3.5-turbo'") || match.content.includes('"gpt-3.5-turbo"')) {
        newContent = newContent.replace(/(['"])gpt-3\.5-turbo\1/g, "$1gpt-4o$1");
        changes.push('Upgrade gpt-3.5-turbo model references to gpt-4o');
      }

      if (match.content.includes("'gpt-4'") || match.content.includes('"gpt-4"')) {
        // Be more careful with gpt-4 to avoid gpt-4o matches
        newContent = newContent.replace(/(['"])gpt-4(?!o|-)(['"])/g, "$1gpt-4o$2");
        changes.push('Upgrade gpt-4 model references to gpt-4o');
      }
    }

    return newContent;
  }

  /**
   * Add initialization calls for the migration client
   */
  private addInitializationCalls(content: string, changes: string[]): string {
    let newContent = content;

    // If this is a file that creates an OpenAI client, add initialization
    if (content.includes('new OpenAI()') || content.includes('new OpenAIClient()')) {
      // Look for async functions that might need await
      const asyncFunctionPattern = /async\s+function\s+([^(]+)\([^)]*\)/g;
      const matches = [...content.matchAll(asyncFunctionPattern)];
      
      if (matches.length > 0) {
        // Add initialization after client creation
        const clientCreationPattern = /((?:const|let|var)\s+\w+\s*=\s*new\s+(?:OpenAI|OpenAIClient)\s*\(\s*\);?)/g;
        if (clientCreationPattern.test(content)) {
          newContent = newContent.replace(clientCreationPattern, '$1\n    await $1.split(\' \')[1].split(\'=\')[0].trim().init();');
          changes.push('Add client initialization call');
        }
      }
    }

    return newContent;
  }

  /**
   * Check if file should be skipped
   */
  private shouldSkipFile(relativePath: string): boolean {
    const skipPatterns = [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /\.next/,
      /coverage/,
      /scripts\/migration/, // Don't migrate our own migration scripts
      /\.backup-/, // Don't migrate backup files
      /\.test\./,
      /\.spec\./,
      /README\.md/,
      /CHANGELOG\.md/,
      /package\.json/,
      /\.d\.ts$/, // Skip type definition files
    ];

    return skipPatterns.some(pattern => pattern.test(relativePath));
  }

  /**
   * Print migration summary
   */
  private printSummary(): void {
    console.log('\n📊 Migration Summary');
    console.log('===================');
    
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const withChanges = successful.filter(r => r.changes.length > 0);
    
    console.log(`✅ Successfully processed: ${successful.length} files`);
    console.log(`🔧 Files with changes: ${withChanges.length} files`);
    console.log(`❌ Failed: ${failed.length} files`);
    
    if (withChanges.length > 0) {
      console.log('\n📝 Files modified:');
      withChanges.forEach(result => {
        console.log(`  ${result.file} (${result.changes.length} changes)`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Failed migrations:');
      failed.forEach(result => {
        console.log(`  ${result.file}: ${result.error}`);
      });
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Review the migrated files for correctness');
    console.log('2. Test the application to ensure everything works');
    console.log('3. Commit the changes if satisfied');
    console.log('4. Remove backup files when no longer needed');
    console.log('\n⚠️  Note: Some manual adjustments may still be needed for complex cases.');
  }
}

// Execute if run directly
if (require.main === module) {
  (async () => {
    try {
      const migrator = new OpenAIMigrator();
      await migrator.migrate();
      console.log('\n✅ Migration completed successfully!');
    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    }
  })();
}

export { OpenAIMigrator, type TransformResult };
