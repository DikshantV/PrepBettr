#!/usr/bin/env tsx

/**
 * Azure AI Foundry Codebase Coverage Audit
 * 
 * Comprehensive audit script that:
 * 1. Enumerates all Foundry-related modules and dependencies
 * 2. Generates dependency graphs and identifies uncovered files
 * 3. Creates test coverage checklists mapping test types to modules
 * 4. Analyzes test coverage gaps and provides recommendations
 * 
 * Usage: npm run audit:foundry:coverage
 * 
 * @version 2.0.0
 */

import { promises as fs } from 'fs';
import { join, relative, extname, dirname } from 'path';
import { execSync } from 'child_process';

interface ModuleInfo {
  path: string;
  type: 'client' | 'service' | 'component' | 'utility' | 'api' | 'config' | 'types';
  dependencies: string[];
  testFiles: string[];
  coverage: {
    unit: boolean;
    integration: boolean;
    e2e: boolean;
    performance: boolean;
  };
  complexity: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface AuditReport {
  summary: {
    totalModules: number;
    testedModules: number;
    coveragePercentage: number;
    missingTests: number;
  };
  modules: ModuleInfo[];
  recommendations: string[];
  dependencyGraph: Record<string, string[]>;
  testGaps: {
    uncovered: string[];
    partialCoverage: string[];
    missingIntegration: string[];
    missingE2E: string[];
  };
}

class FoundryAuditor {
  private rootDir: string;
  private modules: ModuleInfo[] = [];
  private dependencyGraph: Record<string, string[]> = {};

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  /**
   * Main audit execution
   */
  async runAudit(): Promise<AuditReport> {
    console.log('🔍 Starting Azure AI Foundry codebase audit...');
    
    await this.discoverModules();
    await this.analyzeDependencies();
    await this.checkTestCoverage();
    await this.calculateComplexity();
    await this.assignPriorities();
    
    const report = this.generateReport();
    await this.saveReport(report);
    
    console.log('✅ Audit completed successfully!');
    return report;
  }

  /**
   * Discover all Foundry-related modules
   */
  private async discoverModules(): Promise<void> {
    console.log('📁 Discovering Foundry modules...');
    
    const foundryPaths = [
      'lib/azure-ai-foundry',
      'src/lib/azure-ai-foundry',
      'app/api/voice',
      'components',
      'azure/lib/services',
      'tests/unit/azure-ai-foundry',
      'tests/integration/azure-ai-foundry',
      'tests/e2e',
      'tests/perf/foundry'
    ];

    const discoveredFiles = new Set<string>();

    for (const pattern of foundryPaths) {
      const files = await this.findFiles(pattern);
      for (const file of files) {
        const relativePath = relative(this.rootDir, file);
        if (!discoveredFiles.has(relativePath)) {
          discoveredFiles.add(relativePath);
          const moduleInfo = await this.analyzeModule(file);
          if (moduleInfo) {
            this.modules.push(moduleInfo);
          }
        }
      }
    }

    console.log(`📊 Discovered ${this.modules.length} Foundry modules`);
  }

  /**
   * Find files matching pattern
   */
  private async findFiles(pattern: string): Promise<string[]> {
    try {
      // Use find with better pattern matching
      const command = `find ${this.rootDir} -path "*/node_modules" -prune -o -path "*/${pattern}" -type f -print 2>/dev/null || true`;
      const output = execSync(command, { encoding: 'utf8', cwd: this.rootDir });
      const foundFiles = output.split('\n').filter(line => line.trim() && 
        (line.endsWith('.ts') || line.endsWith('.tsx') || line.endsWith('.js') || line.endsWith('.jsx'))
      );
      
      // If specific pattern search yields nothing, fallback to manual discovery
      if (foundFiles.length === 0) {
        return await this.manualDiscovery(pattern);
      }
      
      return foundFiles;
    } catch (error) {
      // Fallback to manual discovery
      return await this.manualDiscovery(pattern);
    }
  }

  /**
   * Manual file discovery fallback
   */
  private async manualDiscovery(pattern: string): Promise<string[]> {
    const results: string[] = [];
    const searchPaths = [
      'lib/azure-ai-foundry',
      'src/lib/azure-ai-foundry',
      'app/api/voice',
      'components',
      'azure/lib/services',
      'tests/unit/azure-ai-foundry',
      'tests/integration/azure-ai-foundry',
      'tests/e2e',
      'tests/perf/foundry'
    ];

    for (const searchPath of searchPaths) {
      const fullPath = join(this.rootDir, searchPath);
      try {
        await this.walkDirectory(fullPath, results, pattern);
      } catch (error) {
        // Directory doesn't exist, skip
      }
    }

    return results;
  }

  /**
   * Recursively walk directory
   */
  private async walkDirectory(dir: string, results: string[], pattern: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, results, pattern);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            // Check if file matches Foundry patterns
            if (this.isFoundryFile(fullPath)) {
              results.push(fullPath);
            }
          }
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }

  /**
   * Check if file is Foundry-related
   */
  private isFoundryFile(filePath: string): boolean {
    const content = filePath.toLowerCase();
    const foundryKeywords = [
      'foundry',
      'azure-ai-foundry',
      'voice-session',
      'voice-agent',
      'model-manager',
      'foundry-client',
      'foundry-config',
      'agent-orchestrator',
      'interview-agent',
      'document-intelligence'
    ];

    return foundryKeywords.some(keyword => 
      content.includes(keyword) || 
      content.includes(keyword.replace('-', ''))
    );
  }

  /**
   * Analyze individual module
   */
  private async analyzeModule(filePath: string): Promise<ModuleInfo | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = relative(this.rootDir, filePath);
      
      return {
        path: relativePath,
        type: this.determineModuleType(filePath, content),
        dependencies: this.extractDependencies(content),
        testFiles: await this.findTestFiles(relativePath),
        coverage: {
          unit: false,
          integration: false,
          e2e: false,
          performance: false
        },
        complexity: 'medium',
        priority: 'medium'
      };
    } catch (error) {
      console.warn(`⚠️ Failed to analyze ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Determine module type
   */
  private determineModuleType(filePath: string, content: string): ModuleInfo['type'] {
    const path = filePath.toLowerCase();
    
    if (path.includes('client') || content.includes('class') && content.includes('Client')) {
      return 'client';
    }
    if (path.includes('service') || content.includes('Service')) {
      return 'service';
    }
    if (path.includes('component') || path.includes('.tsx')) {
      return 'component';
    }
    if (path.includes('api/') || path.includes('route.ts')) {
      return 'api';
    }
    if (path.includes('config') || path.includes('types')) {
      return path.includes('config') ? 'config' : 'types';
    }
    
    return 'utility';
  }

  /**
   * Extract dependencies from module
   */
  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importRegex = /import.*?from\s+['"`]([^'"`]+)['"`]/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.includes('azure-ai-foundry') || 
          importPath.includes('foundry') ||
          importPath.includes('voice')) {
        dependencies.push(importPath);
      }
    }

    return [...new Set(dependencies)];
  }

  /**
   * Find test files for a module
   */
  private async findTestFiles(modulePath: string): Promise<string[]> {
    const testFiles: string[] = [];
    const baseName = modulePath.replace(/\.(ts|tsx|js|jsx)$/, '');
    const moduleDir = dirname(modulePath);
    
    // Common test file patterns
    const testPatterns = [
      `${baseName}.test.ts`,
      `${baseName}.test.tsx`,
      `${baseName}.spec.ts`,
      `${baseName}.spec.tsx`,
      `tests/unit/${baseName}.test.ts`,
      `tests/integration/${baseName}.test.ts`,
      `tests/e2e/${baseName}.spec.ts`,
      `__tests__/${baseName}.test.ts`
    ];

    for (const pattern of testPatterns) {
      const testPath = join(this.rootDir, pattern);
      try {
        await fs.access(testPath);
        testFiles.push(relative(this.rootDir, testPath));
      } catch {
        // Test file doesn't exist
      }
    }

    return testFiles;
  }

  /**
   * Analyze dependencies between modules
   */
  private async analyzeDependencies(): Promise<void> {
    console.log('🔗 Analyzing module dependencies...');
    
    for (const module of this.modules) {
      this.dependencyGraph[module.path] = module.dependencies.filter(dep => 
        this.modules.some(m => m.path.includes(dep.replace('@/', '')))
      );
    }
  }

  /**
   * Check test coverage for each module
   */
  private async checkTestCoverage(): Promise<void> {
    console.log('📋 Checking test coverage...');
    
    for (const module of this.modules) {
      // Check unit tests
      module.coverage.unit = module.testFiles.some(test => 
        test.includes('unit') || test.includes('.test.')
      );

      // Check integration tests
      module.coverage.integration = module.testFiles.some(test => 
        test.includes('integration')
      );

      // Check E2E tests
      module.coverage.e2e = await this.hasE2ECoverage(module.path);

      // Check performance tests
      module.coverage.performance = await this.hasPerformanceCoverage(module.path);
    }
  }

  /**
   * Check if module has E2E test coverage
   */
  private async hasE2ECoverage(modulePath: string): Promise<boolean> {
    const e2eFiles = await this.findFiles('tests/e2e/*.spec.ts');
    
    for (const e2eFile of e2eFiles) {
      try {
        const content = await fs.readFile(e2eFile, 'utf8');
        const moduleBaseName = modulePath.split('/').pop()?.replace(/\.(ts|tsx)$/, '') || '';
        if (content.toLowerCase().includes(moduleBaseName.toLowerCase())) {
          return true;
        }
      } catch {
        // Skip if file can't be read
      }
    }
    
    return false;
  }

  /**
   * Check if module has performance test coverage
   */
  private async hasPerformanceCoverage(modulePath: string): Promise<boolean> {
    const perfFiles = await this.findFiles('tests/perf/**/*.js');
    
    for (const perfFile of perfFiles) {
      try {
        const content = await fs.readFile(perfFile, 'utf8');
        const moduleBaseName = modulePath.split('/').pop()?.replace(/\.(ts|tsx)$/, '') || '';
        if (content.toLowerCase().includes(moduleBaseName.toLowerCase())) {
          return true;
        }
      } catch {
        // Skip if file can't be read
      }
    }
    
    return false;
  }

  /**
   * Calculate complexity for each module
   */
  private async calculateComplexity(): Promise<void> {
    console.log('🧮 Calculating module complexity...');
    
    for (const module of this.modules) {
      try {
        const content = await fs.readFile(join(this.rootDir, module.path), 'utf8');
        const lines = content.split('\n').length;
        const functions = (content.match(/function|=>/g) || []).length;
        const classes = (content.match(/class /g) || []).length;
        const complexity = lines * 0.1 + functions * 2 + classes * 5;

        if (complexity > 100) {
          module.complexity = 'high';
        } else if (complexity > 50) {
          module.complexity = 'medium';
        } else {
          module.complexity = 'low';
        }
      } catch {
        // Default complexity if analysis fails
        module.complexity = 'medium';
      }
    }
  }

  /**
   * Assign priorities based on module characteristics
   */
  private async assignPriorities(): Promise<void> {
    console.log('⭐ Assigning module priorities...');
    
    for (const module of this.modules) {
      // Critical modules
      if (module.type === 'client' || 
          module.path.includes('foundry-client') ||
          module.path.includes('voice-session') ||
          module.path.includes('model-manager')) {
        module.priority = 'critical';
      }
      // High priority modules
      else if (module.type === 'service' || 
               module.type === 'api' ||
               module.complexity === 'high') {
        module.priority = 'high';
      }
      // Medium priority modules
      else if (module.type === 'component' || 
               module.complexity === 'medium') {
        module.priority = 'medium';
      }
      // Low priority modules
      else {
        module.priority = 'low';
      }
    }
  }

  /**
   * Generate comprehensive audit report
   */
  private generateReport(): AuditReport {
    console.log('📊 Generating audit report...');
    
    const testedModules = this.modules.filter(m => 
      m.coverage.unit || m.coverage.integration || m.coverage.e2e
    );
    
    const uncovered = this.modules.filter(m => 
      !m.coverage.unit && !m.coverage.integration && !m.coverage.e2e
    );
    
    const partialCoverage = this.modules.filter(m => 
      m.coverage.unit && (!m.coverage.integration || !m.coverage.e2e)
    );

    const recommendations = this.generateRecommendations();

    return {
      summary: {
        totalModules: this.modules.length,
        testedModules: testedModules.length,
        coveragePercentage: Math.round((testedModules.length / this.modules.length) * 100),
        missingTests: uncovered.length
      },
      modules: this.modules,
      recommendations,
      dependencyGraph: this.dependencyGraph,
      testGaps: {
        uncovered: uncovered.map(m => m.path),
        partialCoverage: partialCoverage.map(m => m.path),
        missingIntegration: this.modules.filter(m => !m.coverage.integration).map(m => m.path),
        missingE2E: this.modules.filter(m => !m.coverage.e2e && m.priority !== 'low').map(m => m.path)
      }
    };
  }

  /**
   * Generate recommendations based on audit results
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const uncoveredCritical = this.modules.filter(m => 
      m.priority === 'critical' && !m.coverage.unit
    );
    
    if (uncoveredCritical.length > 0) {
      recommendations.push(
        `🚨 URGENT: ${uncoveredCritical.length} critical modules lack unit tests: ${uncoveredCritical.map(m => m.path).join(', ')}`
      );
    }

    const highComplexityUntested = this.modules.filter(m => 
      m.complexity === 'high' && !m.coverage.unit
    );
    
    if (highComplexityUntested.length > 0) {
      recommendations.push(
        `⚠️ HIGH PRIORITY: ${highComplexityUntested.length} complex modules need unit tests: ${highComplexityUntested.map(m => m.path).join(', ')}`
      );
    }

    const missingIntegration = this.modules.filter(m => 
      (m.type === 'service' || m.type === 'api') && !m.coverage.integration
    );
    
    if (missingIntegration.length > 0) {
      recommendations.push(
        `🔗 Add integration tests for ${missingIntegration.length} service/API modules`
      );
    }

    const performanceTestGaps = this.modules.filter(m => 
      (m.path.includes('voice') || m.path.includes('agent')) && !m.coverage.performance
    );
    
    if (performanceTestGaps.length > 0) {
      recommendations.push(
        `🚀 Add performance tests for ${performanceTestGaps.length} voice/agent modules`
      );
    }

    return recommendations;
  }

  /**
   * Save audit report to file
   */
  private async saveReport(report: AuditReport): Promise<void> {
    const reportPath = join(this.rootDir, 'audit-results', 'foundry-coverage-audit.json');
    const readablePath = join(this.rootDir, 'audit-results', 'foundry-coverage-report.md');
    
    // Ensure directory exists
    await fs.mkdir(dirname(reportPath), { recursive: true });
    
    // Save JSON report
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Save readable report
    const readableReport = this.generateReadableReport(report);
    await fs.writeFile(readablePath, readableReport);
    
    console.log(`📄 Reports saved:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   Markdown: ${readablePath}`);
  }

  /**
   * Generate readable markdown report
   */
  private generateReadableReport(report: AuditReport): string {
    const { summary, recommendations, testGaps } = report;
    
    return `# Azure AI Foundry Test Coverage Audit Report

Generated on: ${new Date().toISOString()}

## Executive Summary

- **Total Modules**: ${summary.totalModules}
- **Tested Modules**: ${summary.testedModules}
- **Coverage Percentage**: ${summary.coveragePercentage}%
- **Missing Tests**: ${summary.missingTests}

## Recommendations

${recommendations.map(rec => `- ${rec}`).join('\n')}

## Test Gaps Analysis

### Completely Uncovered Modules (${testGaps.uncovered.length})
${testGaps.uncovered.map(path => `- \`${path}\``).join('\n')}

### Partial Coverage (${testGaps.partialCoverage.length})
${testGaps.partialCoverage.map(path => `- \`${path}\``).join('\n')}

### Missing Integration Tests (${testGaps.missingIntegration.length})
${testGaps.missingIntegration.slice(0, 10).map(path => `- \`${path}\``).join('\n')}
${testGaps.missingIntegration.length > 10 ? `- ... and ${testGaps.missingIntegration.length - 10} more` : ''}

### Missing E2E Tests (${testGaps.missingE2E.length})
${testGaps.missingE2E.slice(0, 10).map(path => `- \`${path}\``).join('\n')}
${testGaps.missingE2E.length > 10 ? `- ... and ${testGaps.missingE2E.length - 10} more` : ''}

## Module Details

| Module | Type | Priority | Complexity | Unit | Integration | E2E | Performance |
|--------|------|----------|------------|------|-------------|-----|-------------|
${report.modules.map(m => 
  `| \`${m.path}\` | ${m.type} | ${m.priority} | ${m.complexity} | ${m.coverage.unit ? '✅' : '❌'} | ${m.coverage.integration ? '✅' : '❌'} | ${m.coverage.e2e ? '✅' : '❌'} | ${m.coverage.performance ? '✅' : '❌'} |`
).join('\n')}

## Next Steps

1. **Immediate Actions**: Address critical module test gaps
2. **Short-term**: Add unit tests for high-complexity modules
3. **Medium-term**: Implement integration tests for services/APIs
4. **Long-term**: Complete E2E and performance test coverage

---
*This report was generated automatically by the Azure AI Foundry audit system.*
`;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const auditor = new FoundryAuditor();
    const report = await auditor.runAudit();
    
    console.log('\n🎯 Audit Summary:');
    console.log(`   📊 Coverage: ${report.summary.coveragePercentage}%`);
    console.log(`   📁 Modules: ${report.summary.testedModules}/${report.summary.totalModules}`);
    console.log(`   ⚠️  Missing: ${report.summary.missingTests}`);
    console.log(`   💡 Recommendations: ${report.recommendations.length}`);
    
    if (report.summary.coveragePercentage < 80) {
      console.log('\n⚠️  Coverage below 80% - consider adding more tests');
      process.exit(1);
    }
    
    console.log('\n✅ Audit completed successfully!');
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { FoundryAuditor, type AuditReport, type ModuleInfo };
