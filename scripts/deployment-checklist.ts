#!/usr/bin/env node

/**
 * Deployment Checklist Script
 * Validates that the application is ready for deployment to staging/production
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

class DeploymentChecker {
  private results: CheckResult[] = [];
  private isStaging: boolean;

  constructor(environment: string = 'staging') {
    this.isStaging = environment === 'staging';
    console.log(`🚀 Running deployment checklist for ${environment}...\n`);
  }

  private addResult(result: CheckResult) {
    this.results.push(result);
    const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${result.name}: ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  }

  async checkTypeScript(): Promise<void> {
    console.log('\n📝 Checking TypeScript compilation...');
    try {
      const { stdout, stderr } = await execAsync('npx tsc --noEmit');
      this.addResult({
        name: 'TypeScript Compilation',
        status: 'pass',
        message: 'No TypeScript errors found'
      });
    } catch (error: any) {
      // Check if it's just warnings or actual errors
      const errorOutput = error.stdout || error.stderr || '';
      const errorCount = (errorOutput.match(/Found \d+ error/g) || [])[0];
      
      if (errorCount && !errorCount.includes('Found 0 error')) {
        this.addResult({
          name: 'TypeScript Compilation',
          status: 'fail',
          message: `TypeScript compilation failed: ${errorCount}`,
          details: errorOutput.substring(0, 500) + '...'
        });
      } else {
        this.addResult({
          name: 'TypeScript Compilation',
          status: 'warning',
          message: 'TypeScript compilation completed with warnings',
          details: errorOutput.substring(0, 300)
        });
      }
    }
  }

  async checkEnvironmentVariables(): Promise<void> {
    console.log('\n🔐 Checking environment variables...');
    
    const requiredEnvVars = [
      // Firebase Authentication (Required)
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
      
      // Azure Core Services (Required)
      'AZURE_KEY_VAULT_URL',
      'AZURE_COSMOS_ENDPOINT',
      'AZURE_COSMOS_KEY',
      'AZURE_STORAGE_CONNECTION_STRING',
      
      // Azure AI Services (Required)
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_API_KEY',
      'AZURE_OPENAI_DEPLOYMENT',
      'AZURE_SPEECH_KEY',
      'AZURE_SPEECH_REGION',
      'AZURE_SPEECH_ENDPOINT',
      
      // Monitoring (Required for production)
      'APPLICATIONINSIGHTS_CONNECTION_STRING'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length === 0) {
      this.addResult({
        name: 'Environment Variables',
        status: 'pass',
        message: 'All required environment variables are set'
      });
    } else {
      this.addResult({
        name: 'Environment Variables',
        status: this.isStaging ? 'warning' : 'fail',
        message: `Missing ${missingVars.length} environment variables`,
        details: missingVars
      });
    }
  }

  async checkBuildOutput(): Promise<void> {
    console.log('\n🏗️ Checking build output...');
    
    const buildPath = path.join(process.cwd(), '.next');
    
    if (fs.existsSync(buildPath)) {
      const stats = fs.statSync(buildPath);
      const sizeInMB = stats.size / (1024 * 1024);
      
      this.addResult({
        name: 'Build Output',
        status: 'pass',
        message: '.next directory exists',
        details: { approximate_size: `${sizeInMB.toFixed(2)} MB` }
      });
    } else {
      this.addResult({
        name: 'Build Output',
        status: 'fail',
        message: '.next directory not found - run npm run build first'
      });
    }
  }

  async checkFieldMigration(): Promise<void> {
    console.log('\n🔄 Checking field migration status...');
    
    // Check for old field names in the codebase
    const oldFieldPatterns = [
      'jobDescription',
      'mockInterview',
      'userAnswer'
    ];

    try {
      for (const pattern of oldFieldPatterns) {
        const { stdout } = await execAsync(
          `grep -r "${pattern}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . | wc -l`
        );
        const count = parseInt(stdout.trim());
        
        if (count > 0) {
          this.addResult({
            name: `Field Migration - ${pattern}`,
            status: 'warning',
            message: `Found ${count} occurrences of old field name "${pattern}"`,
            details: 'Consider updating to new field names'
          });
        }
      }
      
      this.addResult({
        name: 'Field Migration',
        status: 'pass',
        message: 'Field migration check completed'
      });
    } catch (error) {
      this.addResult({
        name: 'Field Migration',
        status: 'warning',
        message: 'Could not check field migration status'
      });
    }
  }

  async checkCIWorkflows(): Promise<void> {
    console.log('\n⚙️ Checking CI workflows...');
    
    const workflowPath = path.join(process.cwd(), '.github', 'workflows');
    
    if (fs.existsSync(workflowPath)) {
      const workflows = fs.readdirSync(workflowPath).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      
      this.addResult({
        name: 'CI Workflows',
        status: 'pass',
        message: `Found ${workflows.length} workflow files`,
        details: workflows
      });
    } else {
      this.addResult({
        name: 'CI Workflows',
        status: 'warning',
        message: 'No CI workflows found'
      });
    }
  }

  async runLinting(): Promise<void> {
    console.log('\n🧹 Running linting checks...');
    
    try {
      await execAsync('npm run lint');
      this.addResult({
        name: 'Linting',
        status: 'pass',
        message: 'No linting errors found'
      });
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || '';
      const hasErrors = errorOutput.includes('error');
      
      this.addResult({
        name: 'Linting',
        status: hasErrors ? 'fail' : 'warning',
        message: hasErrors ? 'Linting errors found' : 'Linting warnings found',
        details: errorOutput.substring(0, 300)
      });
    }
  }

  async testAzureConnectivity(): Promise<void> {
    console.log('\n☁️ Testing Azure service connectivity...');
    
    try {
      // Check Azure OpenAI
      if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY) {
        const response = await fetch(`${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments?api-version=2024-02-15-preview`, {
          headers: {
            'api-key': process.env.AZURE_OPENAI_KEY
          }
        });
        
        if (response.ok) {
          this.addResult({
            name: 'Azure OpenAI Connectivity',
            status: 'pass',
            message: 'Successfully connected to Azure OpenAI'
          });
        } else {
          this.addResult({
            name: 'Azure OpenAI Connectivity',
            status: 'warning',
            message: `Azure OpenAI returned status ${response.status}`
          });
        }
      } else {
        this.addResult({
          name: 'Azure OpenAI Connectivity',
          status: 'warning',
          message: 'Azure OpenAI credentials not configured'
        });
      }
    } catch (error: any) {
      this.addResult({
        name: 'Azure Service Connectivity',
        status: 'warning',
        message: 'Could not test Azure connectivity',
        details: error.message
      });
    }
  }

  async runTestInterview(): Promise<void> {
    console.log('\n🎤 Running test interview simulation...');
    
    try {
      // This would typically connect to your staging environment
      // For now, we'll just check if the interview endpoints are reachable
      
      const stagingUrl = process.env.STAGING_URL || 'http://localhost:3000';
      
      // Test if the application is running
      const response = await fetch(stagingUrl);
      
      if (response.ok) {
        this.addResult({
          name: 'Test Interview',
          status: 'pass',
          message: 'Application is accessible and ready for interview testing'
        });
        
        console.log('\n   📋 Manual Test Interview Checklist:');
        console.log('   1. Sign in with test account');
        console.log('   2. Upload a sample resume');
        console.log('   3. Start a mock interview');
        console.log('   4. Complete at least 3 questions');
        console.log('   5. Review feedback generation');
        console.log('   6. Check logs for any errors');
      } else {
        this.addResult({
          name: 'Test Interview',
          status: 'warning',
          message: `Application returned status ${response.status}`
        });
      }
    } catch (error: any) {
      this.addResult({
        name: 'Test Interview',
        status: 'warning',
        message: 'Could not reach application for testing',
        details: error.message
      });
    }
  }

  async generateReport(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEPLOYMENT READINESS REPORT');
    console.log('='.repeat(60));
    
    const passed = this.results.filter(r => r.status === 'pass').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    
    console.log(`\n✅ Passed: ${passed}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\n🚨 DEPLOYMENT BLOCKED: Fix all failed checks before deploying');
      process.exit(1);
    } else if (warnings > 0) {
      console.log('\n⚠️ DEPLOYMENT ALLOWED WITH WARNINGS: Review warnings before production');
    } else {
      console.log('\n✅ ALL CHECKS PASSED: Ready for deployment!');
    }
    
    // Save report to file
    const reportPath = path.join(process.cwd(), 'deployment-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      environment: this.isStaging ? 'staging' : 'production',
      summary: { passed, warnings, failed },
      results: this.results
    }, null, 2));
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
  }

  async run(): Promise<void> {
    try {
      await this.checkTypeScript();
      await this.checkEnvironmentVariables();
      await this.checkBuildOutput();
      await this.checkFieldMigration();
      await this.checkCIWorkflows();
      await this.runLinting();
      await this.testAzureConnectivity();
      await this.runTestInterview();
      await this.generateReport();
    } catch (error: any) {
      console.error('\n❌ Deployment checker failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the checker
const environment = process.argv[2] || 'staging';
const checker = new DeploymentChecker(environment);
checker.run();
