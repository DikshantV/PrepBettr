#!/usr/bin/env ts-node
/**
 * Baseline Metrics Collection Script
 * 
 * Collects comprehensive metrics before refactoring to track improvements.
 * This will help us measure the success of our refactoring efforts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface FileMetrics {
  path: string;
  lines: number;
  functions: number;
  complexity: number;
  anyTypes: number;
}

interface BaselineMetrics {
  timestamp: Date;
  files: {
    total: number;
    overSized: FileMetrics[]; // Files > 400 lines
    largest: FileMetrics[];   // Top 10 largest files
  };
  codeQuality: {
    totalAnyTypes: number;
    duplicatedLines: number;
    duplicatedBlocks: number;
    averageComplexity: number;
    functionsOverLimit: number; // Functions > 30 lines
  };
  dependencies: {
    circularDependencies: string[];
    dependencyCount: number;
  };
  testing: {
    totalTests: number;
    coverage: {
      statements: number;
      branches: number;
      functions: number;
      lines: number;
    };
  };
  build: {
    timeSeconds: number;
    bundleSize: number;
    mainChunkSize: number;
  };
}

class MetricsCollector {
  private baseDir = process.cwd();
  private sourceDirectories = ['lib', 'components', 'app', 'contexts', 'types'];
  private fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];

  async collectAll(): Promise<BaselineMetrics> {
    console.log('📊 Collecting baseline metrics...\n');

    const metrics: BaselineMetrics = {
      timestamp: new Date(),
      files: await this.collectFileMetrics(),
      codeQuality: await this.collectCodeQualityMetrics(),
      dependencies: await this.collectDependencyMetrics(),
      testing: await this.collectTestingMetrics(),
      build: await this.collectBuildMetrics()
    };

    return metrics;
  }

  private async collectFileMetrics() {
    console.log('🔍 Analyzing file sizes and complexity...');
    
    const allFiles = this.getAllSourceFiles();
    const fileMetrics: FileMetrics[] = [];

    for (const filePath of allFiles) {
      const metrics = await this.analyzeFile(filePath);
      if (metrics) {
        fileMetrics.push(metrics);
      }
    }

    // Sort by lines descending
    fileMetrics.sort((a, b) => b.lines - a.lines);
    
    const overSized = fileMetrics.filter(f => f.lines > 400);
    const largest = fileMetrics.slice(0, 10);

    console.log(`   ✅ Analyzed ${fileMetrics.length} files`);
    console.log(`   🚨 Found ${overSized.length} oversized files (>400 lines)`);

    return {
      total: fileMetrics.length,
      overSized,
      largest
    };
  }

  private async collectCodeQualityMetrics() {
    console.log('🔍 Analyzing code quality...');

    // Count 'any' types
    const anyTypeCount = await this.countAnyTypes();
    console.log(`   📝 Found ${anyTypeCount} 'any' type usages`);

    // Run code duplication analysis if jscpd is available
    let duplicatedLines = 0;
    let duplicatedBlocks = 0;
    try {
      const jscpdResult = await this.runJSCPD();
      duplicatedLines = jscpdResult.duplicatedLines;
      duplicatedBlocks = jscpdResult.duplicatedBlocks;
      console.log(`   🔄 Found ${duplicatedBlocks} duplicated blocks (${duplicatedLines} lines)`);
    } catch (error) {
      console.log('   ⚠️  JSCPD not available, skipping duplication analysis');
    }

    return {
      totalAnyTypes: anyTypeCount,
      duplicatedLines,
      duplicatedBlocks,
      averageComplexity: 0, // Would need ESLint complexity plugin
      functionsOverLimit: 0 // Would need AST analysis
    };
  }

  private async collectDependencyMetrics() {
    console.log('🔍 Analyzing dependencies...');

    let circularDependencies: string[] = [];
    let dependencyCount = 0;

    try {
      // Try to run madge for circular dependency detection
      const madgeOutput = execSync('npx madge --circular --json lib/ components/', { 
        encoding: 'utf-8',
        cwd: this.baseDir 
      });
      
      circularDependencies = JSON.parse(madgeOutput) || [];
      console.log(`   🔄 Found ${circularDependencies.length} circular dependencies`);
    } catch (error) {
      console.log('   ⚠️  Madge not available, skipping circular dependency check');
    }

    // Count dependencies from package.json
    try {
      const packageJson = JSON.parse(fs.readFileSync(
        path.join(this.baseDir, 'package.json'), 
        'utf-8'
      ));
      dependencyCount = Object.keys(packageJson.dependencies || {}).length + 
                       Object.keys(packageJson.devDependencies || {}).length;
      console.log(`   📦 Total dependencies: ${dependencyCount}`);
    } catch (error) {
      console.log('   ⚠️  Cannot read package.json');
    }

    return {
      circularDependencies,
      dependencyCount
    };
  }

  private async collectTestingMetrics() {
    console.log('🔍 Analyzing test coverage...');

    let totalTests = 0;
    let coverage = {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    };

    // Count test files
    const testFiles = this.getAllFiles()
      .filter(f => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f));
    totalTests = testFiles.length;

    // Try to get coverage from jest
    try {
      const coverageOutput = execSync('npm run test:coverage --silent 2>/dev/null || echo "No coverage"', {
        encoding: 'utf-8',
        cwd: this.baseDir
      });
      
      // Parse coverage if available - this is a simplified version
      // In reality, you'd parse the JSON coverage report
      console.log(`   🧪 Found ${totalTests} test files`);
      console.log('   📊 Coverage data would need jest configuration');
    } catch (error) {
      console.log(`   🧪 Found ${totalTests} test files (coverage analysis unavailable)`);
    }

    return {
      totalTests,
      coverage
    };
  }

  private async collectBuildMetrics() {
    console.log('🔍 Analyzing build performance...');

    let timeSeconds = 0;
    let bundleSize = 0;
    let mainChunkSize = 0;

    try {
      // Measure build time
      const startTime = Date.now();
      execSync('npm run build --silent 2>/dev/null', {
        cwd: this.baseDir,
        timeout: 300000 // 5 minutes max
      });
      timeSeconds = (Date.now() - startTime) / 1000;

      // Try to get bundle size from build output
      const buildDir = path.join(this.baseDir, '.next');
      if (fs.existsSync(buildDir)) {
        // This is a simplified version - Next.js stores build info differently
        console.log(`   ⏱️  Build time: ${timeSeconds.toFixed(2)}s`);
        console.log('   📦 Bundle analysis would need webpack-bundle-analyzer');
      }
    } catch (error) {
      console.log('   ⚠️  Build metrics unavailable (build failed or too slow)');
    }

    return {
      timeSeconds,
      bundleSize,
      mainChunkSize
    };
  }

  private getAllSourceFiles(): string[] {
    return this.getAllFiles()
      .filter(f => this.fileExtensions.some(ext => f.endsWith(ext)))
      .filter(f => this.sourceDirectories.some(dir => f.includes(dir)))
      .filter(f => !f.includes('node_modules'))
      .filter(f => !f.includes('.next'))
      .filter(f => !f.includes('dist'));
  }

  private getAllFiles(): string[] {
    const files: string[] = [];
    
    const walkDir = (dir: string) => {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            walkDir(fullPath);
          } else if (stat.isFile()) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walkDir(this.baseDir);
    return files;
  }

  private async analyzeFile(filePath: string): Promise<FileMetrics | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;
      
      // Simple function counting (not perfect but gives an idea)
      const functions = (content.match(/\b(function|async function|\w+\s*=>|\w+\s*\(.*\)\s*{)/g) || []).length;
      
      // Count 'any' types in this file
      const anyTypes = (content.match(/:\s*any\b/g) || []).length;

      return {
        path: path.relative(this.baseDir, filePath),
        lines,
        functions,
        complexity: 0, // Would need proper AST analysis
        anyTypes
      };
    } catch (error) {
      return null;
    }
  }

  private async countAnyTypes(): Promise<number> {
    const files = this.getAllSourceFiles();
    let total = 0;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const matches = content.match(/:\s*any\b/g) || [];
        total += matches.length;
      } catch (error) {
        // Skip files we can't read
      }
    }

    return total;
  }

  private async runJSCPD(): Promise<{ duplicatedLines: number; duplicatedBlocks: number }> {
    try {
      const output = execSync('npx jscpd --reporters json --silent lib/ components/', {
        encoding: 'utf-8',
        cwd: this.baseDir
      });
      
      const result = JSON.parse(output);
      return {
        duplicatedLines: result.statistics?.total?.duplicatedLines || 0,
        duplicatedBlocks: result.statistics?.total?.duplicatedBlocks || 0
      };
    } catch (error) {
      throw new Error('JSCPD not available');
    }
  }

  async saveMetrics(metrics: BaselineMetrics) {
    const outputDir = path.join(this.baseDir, 'refactor-metrics');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, `baseline-${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(metrics, null, 2));

    console.log(`\n📊 Baseline metrics saved to: ${path.relative(this.baseDir, outputFile)}`);
    
    // Also create a human-readable summary
    this.generateSummaryReport(metrics, outputDir);
  }

  private generateSummaryReport(metrics: BaselineMetrics, outputDir: string) {
    const summaryFile = path.join(outputDir, 'baseline-summary.md');
    
    const summary = `# PrepBettr Refactoring Baseline Metrics

Generated: ${metrics.timestamp.toLocaleString()}

## 📁 File Analysis
- **Total files analyzed**: ${metrics.files.total}
- **Oversized files** (>400 lines): ${metrics.files.overSized.length}
- **Largest files**:
${metrics.files.largest.slice(0, 5).map(f => `  - ${f.path} (${f.lines} lines)`).join('\n')}

## 🔍 Code Quality
- **Total 'any' types**: ${metrics.codeQuality.totalAnyTypes}
- **Duplicated blocks**: ${metrics.codeQuality.duplicatedBlocks}
- **Duplicated lines**: ${metrics.codeQuality.duplicatedLines}

## 📦 Dependencies  
- **Total dependencies**: ${metrics.dependencies.dependencyCount}
- **Circular dependencies**: ${metrics.dependencies.circularDependencies.length}

## 🧪 Testing
- **Test files**: ${metrics.testing.totalTests}

## 🏗️ Build Performance
- **Build time**: ${metrics.build.timeSeconds}s
- **Bundle size**: ${metrics.build.bundleSize} bytes

## 🎯 Top Priority Files for Refactoring

${metrics.files.overSized.slice(0, 10).map((f, i) => 
  `${i + 1}. **${f.path}** - ${f.lines} lines, ${f.anyTypes} 'any' types`
).join('\n')}

---

*This baseline will be used to measure refactoring progress and ensure improvements.*
`;

    fs.writeFileSync(summaryFile, summary);
    console.log(`📄 Summary report: ${path.relative(this.baseDir, summaryFile)}`);
  }
}

// Main execution
async function main() {
  const collector = new MetricsCollector();
  
  try {
    const metrics = await collector.collectAll();
    await collector.saveMetrics(metrics);
    
    console.log('\n✅ Baseline metrics collection complete!');
    console.log('🚀 Ready to begin refactoring with measurable targets.');
  } catch (error) {
    console.error('❌ Failed to collect baseline metrics:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}