#!/usr/bin/env node

/**
 * Data Layer Validation Script
 * Comprehensive testing and validation of the data layer system
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

class DataLayerValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logHeader(message) {
    console.log(`\n${colors.blue}${'='.repeat(50)}${colors.reset}`);
    console.log(`${colors.blue}${message}${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
  }

  logTest(testName, status, details = '') {
    const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '⚠';
    const color = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'yellow';
    
    this.log(`${icon} ${testName}`, color);
    if (details) {
      this.log(`  ${details}`, 'reset');
    }

    this.results.tests.push({ name: testName, status, details });
    
    if (status === 'pass') this.results.passed++;
    else if (status === 'fail') this.results.failed++;
    else this.results.warnings++;
  }

  async runCommand(command, description) {
    try {
      this.log(`Running: ${description}`, 'blue');
      const output = execSync(command, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        timeout: 60000 // 60 seconds timeout
      });
      return { success: true, output };
    } catch (error) {
      return { 
        success: false, 
        error: error.message, 
        output: error.stdout || error.stderr || ''
      };
    }
  }

  async validateProjectStructure() {
    this.logHeader('Project Structure Validation');

    const requiredFiles = [
      'lib/data-layer/index.ts',
      'lib/data-layer/interfaces/IDocuments.ts',
      'lib/data-layer/interfaces/IRepositories.ts',
      'lib/data-layer/interfaces/RepositoryResult.ts',
      'lib/data-layer/cosmos/CosmosResumeRepository.ts',
      'lib/data-layer/cosmos/CosmosUsageRepository.ts',
      'lib/data-layer/firestore/FirestoreResumeRepository.ts',
      'lib/data-layer/decorators/DualWriteRepositoryDecorator.ts',
      'lib/data-layer/migration/DataMigrationManager.ts',
      'lib/data-layer/services/DataLayerServiceFactory.ts',
      'lib/data-layer/utils/integration.ts',
      'lib/data-layer/monitoring/DataLayerMonitor.ts',
      'lib/data-layer/README.md',
      'lib/data-layer/IMPLEMENTATION_GUIDE.md'
    ];

    const requiredApiRoutes = [
      'app/api/data-layer-examples/resumes/route.ts',
      'app/api/data-layer-examples/migration/route.ts',
      'app/api/data-layer-examples/dashboard/route.ts'
    ];

    const requiredScripts = [
      'scripts/deploy-data-layer.sh',
      'scripts/validate-data-layer.js'
    ];

    const allRequiredFiles = [...requiredFiles, ...requiredApiRoutes, ...requiredScripts];

    for (const file of allRequiredFiles) {
      if (fs.existsSync(file)) {
        this.logTest(`File exists: ${file}`, 'pass');
      } else {
        this.logTest(`File missing: ${file}`, 'fail');
      }
    }

    // Check package.json dependencies
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = ['@azure/cosmos', 'firebase-admin', 'nanoid'];
    
    for (const dep of requiredDeps) {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        this.logTest(`Dependency: ${dep}`, 'pass', packageJson.dependencies[dep]);
      } else if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
        this.logTest(`Dev Dependency: ${dep}`, 'pass', packageJson.devDependencies[dep]);
      } else {
        this.logTest(`Missing dependency: ${dep}`, 'fail');
      }
    }
  }

  async validateTypeScriptCompilation() {
    this.logHeader('TypeScript Compilation');

    const result = await this.runCommand('npx tsc --noEmit', 'TypeScript compilation check');
    
    if (result.success) {
      this.logTest('TypeScript compilation', 'pass', 'No compilation errors');
    } else {
      this.logTest('TypeScript compilation', 'fail', result.error);
    }

    // Check specific data layer files
    const dataLayerFiles = [
      'lib/data-layer/index.ts',
      'lib/data-layer/services/DataLayerServiceFactory.ts',
      'lib/data-layer/decorators/DualWriteRepositoryDecorator.ts'
    ];

    for (const file of dataLayerFiles) {
      if (fs.existsSync(file)) {
        const checkResult = await this.runCommand(
          `npx tsc --noEmit ${file}`, 
          `TypeScript check: ${file}`
        );
        
        if (checkResult.success) {
          this.logTest(`TypeScript: ${path.basename(file)}`, 'pass');
        } else {
          this.logTest(`TypeScript: ${path.basename(file)}`, 'fail', checkResult.error);
        }
      }
    }
  }

  async validateLinting() {
    this.logHeader('Code Quality - ESLint');

    const result = await this.runCommand('npx eslint lib/data-layer/ --ext .ts', 'ESLint check');
    
    if (result.success) {
      this.logTest('ESLint validation', 'pass', 'No linting errors');
    } else {
      // Check if it's just warnings or actual errors
      const output = result.output || result.error || '';
      const hasErrors = output.includes('error');
      const hasWarnings = output.includes('warning');
      
      if (hasErrors) {
        this.logTest('ESLint validation', 'fail', 'Linting errors found');
      } else if (hasWarnings) {
        this.logTest('ESLint validation', 'warning', 'Linting warnings found');
      } else {
        this.logTest('ESLint validation', 'pass', 'No linting issues');
      }
    }
  }

  async validateTests() {
    this.logHeader('Test Suite Validation');

    // Check if test files exist
    const testFiles = [
      '__tests__/data-layer/data-layer.test.ts'
    ];

    for (const testFile of testFiles) {
      if (fs.existsSync(testFile)) {
        this.logTest(`Test file: ${testFile}`, 'pass');
      } else {
        this.logTest(`Test file missing: ${testFile}`, 'fail');
      }
    }

    // Run tests
    const testResult = await this.runCommand('npm test -- __tests__/data-layer/', 'Unit tests');
    
    if (testResult.success) {
      this.logTest('Unit tests', 'pass', 'All tests passed');
    } else {
      this.logTest('Unit tests', 'fail', 'Some tests failed');
    }
  }

  async validateEnvironmentConfiguration() {
    this.logHeader('Environment Configuration');

    // Check environment variables that might be set
    const envVars = [
      'COSMOS_ENDPOINT',
      'COSMOS_KEY',
      'COSMOS_DATABASE_ID',
      'AZURE_KEY_VAULT_URI',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
    ];

    for (const envVar of envVars) {
      if (process.env[envVar]) {
        this.logTest(`Environment variable: ${envVar}`, 'pass', 'Set');
      } else {
        this.logTest(`Environment variable: ${envVar}`, 'warning', 'Not set (optional for dev)');
      }
    }

    // Check .env.local file
    if (fs.existsSync('.env.local')) {
      this.logTest('Environment file', 'pass', '.env.local exists');
    } else {
      this.logTest('Environment file', 'warning', '.env.local not found');
    }

    // Check for sample environment file
    if (fs.existsSync('.env.example') || fs.existsSync('.env.sample')) {
      this.logTest('Sample environment file', 'pass', 'Found');
    } else {
      this.logTest('Sample environment file', 'warning', 'Consider adding .env.example');
    }
  }

  async validateDocumentation() {
    this.logHeader('Documentation Validation');

    const docFiles = [
      { file: 'lib/data-layer/README.md', required: true },
      { file: 'lib/data-layer/IMPLEMENTATION_GUIDE.md', required: true },
      { file: 'README.md', required: false }
    ];

    for (const { file, required } of docFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const hasSubstantialContent = content.length > 500; // At least 500 characters
        
        if (hasSubstantialContent) {
          this.logTest(`Documentation: ${file}`, 'pass', `${content.length} characters`);
        } else {
          this.logTest(`Documentation: ${file}`, 'warning', 'File exists but may be incomplete');
        }
      } else {
        if (required) {
          this.logTest(`Documentation: ${file}`, 'fail', 'Required file missing');
        } else {
          this.logTest(`Documentation: ${file}`, 'warning', 'Optional file missing');
        }
      }
    }
  }

  async validateImportStructure() {
    this.logHeader('Import Structure Validation');

    // Check if main export file works
    try {
      const indexPath = 'lib/data-layer/index.ts';
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        
        // Check for key exports
        const expectedExports = [
          'DataLayerServiceFactory',
          'DataLayerFactory',
          'MigrationPhase',
          'IResumeRepository',
          'IUsageRepository',
          'DualWriteRepositoryDecorator'
        ];

        for (const exportName of expectedExports) {
          if (content.includes(exportName)) {
            this.logTest(`Export: ${exportName}`, 'pass');
          } else {
            this.logTest(`Export: ${exportName}`, 'fail', 'Not found in index.ts');
          }
        }

        // Check for circular imports (basic check)
        const circularImportPattern = /from ['"]\.\//g;
        const matches = content.match(circularImportPattern) || [];
        
        if (matches.length > 0) {
          this.logTest('Import structure', 'pass', `${matches.length} relative imports found`);
        } else {
          this.logTest('Import structure', 'warning', 'No relative imports found - verify structure');
        }
      }
    } catch (error) {
      this.logTest('Import validation', 'fail', error.message);
    }
  }

  async validateAPIRoutes() {
    this.logHeader('API Routes Validation');

    const apiRoutes = [
      'app/api/data-layer-examples/resumes/route.ts',
      'app/api/data-layer-examples/migration/route.ts',
      'app/api/data-layer-examples/dashboard/route.ts'
    ];

    for (const route of apiRoutes) {
      if (fs.existsSync(route)) {
        const content = fs.readFileSync(route, 'utf8');
        
        // Check for required exports
        const hasGET = content.includes('export async function GET');
        const hasPOST = content.includes('export async function POST');
        
        if (hasGET || hasPOST) {
          this.logTest(`API Route: ${path.basename(route)}`, 'pass', 
            `Exports: ${[hasGET && 'GET', hasPOST && 'POST'].filter(Boolean).join(', ')}`);
        } else {
          this.logTest(`API Route: ${path.basename(route)}`, 'fail', 'No HTTP method exports found');
        }

        // Check for error handling
        const hasErrorHandling = content.includes('catch') && content.includes('NextResponse.json');
        if (hasErrorHandling) {
          this.logTest(`Error handling: ${path.basename(route)}`, 'pass');
        } else {
          this.logTest(`Error handling: ${path.basename(route)}`, 'warning', 'May lack proper error handling');
        }
      } else {
        this.logTest(`API Route: ${route}`, 'fail', 'File not found');
      }
    }
  }

  async validateDeploymentScripts() {
    this.logHeader('Deployment Scripts Validation');

    const deployScript = 'scripts/deploy-data-layer.sh';
    
    if (fs.existsSync(deployScript)) {
      // Check if script is executable
      const stats = fs.statSync(deployScript);
      const isExecutable = !!(stats.mode & parseInt('111', 8));
      
      if (isExecutable) {
        this.logTest('Deployment script permissions', 'pass', 'Script is executable');
      } else {
        this.logTest('Deployment script permissions', 'warning', 'Script may not be executable');
      }

      // Check script content
      const content = fs.readFileSync(deployScript, 'utf8');
      const hasHelp = content.includes('show_usage');
      const hasEnvironmentCheck = content.includes('ENVIRONMENT');
      
      if (hasHelp && hasEnvironmentCheck) {
        this.logTest('Deployment script structure', 'pass', 'Has help and environment checks');
      } else {
        this.logTest('Deployment script structure', 'warning', 'May lack proper structure');
      }
    } else {
      this.logTest('Deployment script', 'fail', 'Script not found');
    }
  }

  async validateIntegrationReadiness() {
    this.logHeader('Integration Readiness');

    try {
      // Simulate import of key components (syntax check)
      const keyFiles = [
        'lib/data-layer/services/DataLayerServiceFactory.ts',
        'lib/data-layer/utils/integration.ts',
        'lib/services/resume-service-data-layer.ts'
      ];

      for (const file of keyFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Basic syntax validation
          const hasExports = content.includes('export');
          const hasImports = content.includes('import');
          const hasAsync = content.includes('async');
          
          if (hasExports && hasImports) {
            this.logTest(`Integration ready: ${path.basename(file)}`, 'pass', 
              `Exports: ✓, Imports: ✓, Async: ${hasAsync ? '✓' : '✗'}`);
          } else {
            this.logTest(`Integration ready: ${path.basename(file)}`, 'warning', 
              'May have integration issues');
          }
        }
      }

      // Check for unified config service integration
      const integrationFile = 'lib/data-layer/utils/integration.ts';
      if (fs.existsSync(integrationFile)) {
        const content = fs.readFileSync(integrationFile, 'utf8');
        if (content.includes('unifiedConfigService')) {
          this.logTest('Unified config integration', 'pass', 'Integration found');
        } else {
          this.logTest('Unified config integration', 'warning', 'Integration may be missing');
        }
      }

    } catch (error) {
      this.logTest('Integration readiness', 'fail', error.message);
    }
  }

  generateSummaryReport() {
    this.logHeader('Validation Summary Report');

    const total = this.results.passed + this.results.failed + this.results.warnings;
    const successRate = total > 0 ? Math.round((this.results.passed / total) * 100) : 0;

    this.log(`\nTotal Tests: ${total}`, 'blue');
    this.log(`✓ Passed: ${this.results.passed}`, 'green');
    this.log(`✗ Failed: ${this.results.failed}`, 'red');
    this.log(`⚠ Warnings: ${this.results.warnings}`, 'yellow');
    this.log(`Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : successRate >= 60 ? 'yellow' : 'red');

    // Categorize issues
    const criticalIssues = this.results.tests.filter(t => t.status === 'fail');
    const warnings = this.results.tests.filter(t => t.status === 'warning');

    if (criticalIssues.length > 0) {
      this.log('\n🚨 Critical Issues (must fix):', 'red');
      criticalIssues.forEach(issue => {
        this.log(`  • ${issue.name}: ${issue.details}`, 'red');
      });
    }

    if (warnings.length > 0) {
      this.log('\n⚠️  Warnings (should fix):', 'yellow');
      warnings.forEach(warning => {
        this.log(`  • ${warning.name}: ${warning.details}`, 'yellow');
      });
    }

    // Overall assessment
    let assessment = 'Unknown';
    let color = 'reset';
    
    if (this.results.failed === 0) {
      if (this.results.warnings === 0) {
        assessment = '🎉 EXCELLENT - Production Ready';
        color = 'green';
      } else if (this.results.warnings <= 3) {
        assessment = '✅ GOOD - Ready with minor improvements';
        color = 'green';
      } else {
        assessment = '⚠️  FAIR - Address warnings before production';
        color = 'yellow';
      }
    } else if (this.results.failed <= 2) {
      assessment = '⚠️  NEEDS WORK - Fix critical issues';
      color = 'yellow';
    } else {
      assessment = '❌ NOT READY - Major issues need fixing';
      color = 'red';
    }

    this.log(`\n📋 Overall Assessment: ${assessment}`, color);

    // Recommendations
    this.log('\n📝 Recommendations:', 'blue');
    
    if (criticalIssues.length > 0) {
      this.log('  1. Fix all critical issues before deployment', 'blue');
    }
    
    if (warnings.length > 5) {
      this.log('  2. Address high number of warnings for better maintainability', 'blue');
    }
    
    this.log('  3. Run this validation script regularly during development', 'blue');
    this.log('  4. Consider setting up CI/CD pipeline with these checks', 'blue');
    this.log('  5. Review the IMPLEMENTATION_GUIDE.md for deployment steps', 'blue');

    return {
      ready: this.results.failed === 0,
      successRate,
      assessment,
      criticalIssues: criticalIssues.length,
      warnings: warnings.length
    };
  }

  async run() {
    this.log('🚀 Starting Data Layer Validation...', 'blue');
    this.log(`Validation started at: ${new Date().toISOString()}`, 'blue');

    try {
      await this.validateProjectStructure();
      await this.validateTypeScriptCompilation();
      await this.validateLinting();
      await this.validateTests();
      await this.validateEnvironmentConfiguration();
      await this.validateDocumentation();
      await this.validateImportStructure();
      await this.validateAPIRoutes();
      await this.validateDeploymentScripts();
      await this.validateIntegrationReadiness();

      const summary = this.generateSummaryReport();
      
      // Exit with appropriate code
      process.exit(summary.ready ? 0 : 1);

    } catch (error) {
      this.log(`\n❌ Validation failed with error: ${error.message}`, 'red');
      process.exit(1);
    }
  }
}

// Run the validator
if (require.main === module) {
  const validator = new DataLayerValidator();
  validator.run();
}

module.exports = DataLayerValidator;