#!/usr/bin/env ts-node

/**
 * Environment Audit Script for Azure App Service
 * 
 * This script validates Firebase configuration in production environments,
 * especially Azure App Service deployment slots, to identify configuration
 * issues that cause 401 authentication errors.
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables in development
if (process.env.NODE_ENV !== 'production' && fs.existsSync('.env.local')) {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
}

interface AuditResult {
  timestamp: string;
  environment: string;
  checks: {
    firebase: FirebaseCheck;
    azure: AzureCheck;
    general: GeneralCheck;
  };
  issues: Issue[];
  recommendations: string[];
  exitCode: number;
}

interface FirebaseCheck {
  hasPrivateKey: boolean;
  privateKeyLength: number;
  privateKeyFormat: 'PEM' | 'unknown' | 'missing';
  privateKeyNewlineFormat: 'correct' | 'escaped' | 'double_escaped' | 'mixed';
  hasClientEmail: boolean;
  clientEmailFormat: 'valid' | 'invalid' | 'missing';
  projectIdPresent: boolean;
  projectIdSource: 'env' | 'next_public' | 'both' | 'missing';
  projectIdMatch: boolean;
}

interface AzureCheck {
  keyVaultUriPresent: boolean;
  keyVaultUriFormat: 'valid' | 'invalid' | 'missing';
  managedIdentityExpected: boolean;
  appServiceEnvironment: boolean;
}

interface GeneralCheck {
  nodeEnv: string;
  nextJsEnv: 'development' | 'production' | 'test' | 'unknown';
  hasRequiredPackages: boolean;
  packageVersions: Record<string, string>;
}

interface Issue {
  severity: 'critical' | 'warning' | 'info';
  category: 'firebase' | 'azure' | 'general';
  message: string;
  fix?: string;
  documentation?: string;
}

class EnvironmentAuditor {
  private result: AuditResult;

  constructor() {
    this.result = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      checks: {
        firebase: {} as FirebaseCheck,
        azure: {} as AzureCheck,
        general: {} as GeneralCheck
      },
      issues: [],
      recommendations: [],
      exitCode: 0
    };
  }

  /**
   * Run all audit checks
   */
  async audit(): Promise<AuditResult> {
    console.log('🔍 Starting environment audit for Firebase Admin SDK...\n');

    await this.auditFirebase();
    await this.auditAzure();
    await this.auditGeneral();
    this.generateRecommendations();
    this.calculateExitCode();

    return this.result;
  }

  /**
   * Audit Firebase-specific configuration
   */
  private async auditFirebase(): Promise<void> {
    console.log('🔥 Auditing Firebase configuration...');

    // Check private key
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    this.result.checks.firebase.hasPrivateKey = !!privateKey;
    this.result.checks.firebase.privateKeyLength = privateKey?.length || 0;

    if (privateKey) {
      // Check private key format
      if (privateKey.includes('-----BEGIN PRIVATE KEY-----') && privateKey.includes('-----END PRIVATE KEY-----')) {
        this.result.checks.firebase.privateKeyFormat = 'PEM';
      } else {
        this.result.checks.firebase.privateKeyFormat = 'unknown';
        this.addIssue('critical', 'firebase', 'Private key is not in valid PEM format', 
          'Ensure the private key starts with "-----BEGIN PRIVATE KEY-----" and ends with "-----END PRIVATE KEY-----"');
      }

      // Check newline format
      const hasRealNewlines = privateKey.includes('\n');
      const hasEscapedNewlines = privateKey.includes('\\n');
      const hasDoubleEscapedNewlines = privateKey.includes('\\\\n');

      if (hasDoubleEscapedNewlines) {
        this.result.checks.firebase.privateKeyNewlineFormat = 'double_escaped';
        this.addIssue('critical', 'firebase', 'Private key has double-escaped newlines (\\\\n)', 
          'Use: echo $FIREBASE_PRIVATE_KEY | sed \'s/\\\\\\\\n/\\n/g\' to fix formatting');
      } else if (hasEscapedNewlines && !hasRealNewlines) {
        this.result.checks.firebase.privateKeyNewlineFormat = 'escaped';
        this.addIssue('warning', 'firebase', 'Private key has escaped newlines (\\n) - may need unescaping');
      } else if (hasEscapedNewlines && hasRealNewlines) {
        this.result.checks.firebase.privateKeyNewlineFormat = 'mixed';
        this.addIssue('warning', 'firebase', 'Private key has mixed newline formats');
      } else if (hasRealNewlines) {
        this.result.checks.firebase.privateKeyNewlineFormat = 'correct';
      } else {
        this.addIssue('critical', 'firebase', 'Private key appears to be a single line without proper newlines');
      }
    } else {
      this.addIssue('critical', 'firebase', 'FIREBASE_PRIVATE_KEY environment variable is missing');
    }

    // Check client email
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    this.result.checks.firebase.hasClientEmail = !!clientEmail;

    if (clientEmail) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isServiceAccount = clientEmail.includes('@') && clientEmail.includes('.iam.gserviceaccount.com');
      
      if (emailRegex.test(clientEmail) && isServiceAccount) {
        this.result.checks.firebase.clientEmailFormat = 'valid';
      } else {
        this.result.checks.firebase.clientEmailFormat = 'invalid';
        this.addIssue('critical', 'firebase', 'Firebase client email is not a valid service account email');
      }
    } else {
      this.result.checks.firebase.clientEmailFormat = 'missing';
      this.addIssue('critical', 'firebase', 'FIREBASE_CLIENT_EMAIL environment variable is missing');
    }

    // Check project ID
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const nextPublicProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    
    this.result.checks.firebase.projectIdPresent = !!(projectId || nextPublicProjectId);
    
    if (projectId && nextPublicProjectId) {
      this.result.checks.firebase.projectIdSource = 'both';
      this.result.checks.firebase.projectIdMatch = projectId === nextPublicProjectId;
      
      if (!this.result.checks.firebase.projectIdMatch) {
        this.addIssue('warning', 'firebase', 
          `Project ID mismatch: FIREBASE_PROJECT_ID="${projectId}" vs NEXT_PUBLIC_FIREBASE_PROJECT_ID="${nextPublicProjectId}"`);
      }
    } else if (projectId) {
      this.result.checks.firebase.projectIdSource = 'env';
      this.result.checks.firebase.projectIdMatch = true;
    } else if (nextPublicProjectId) {
      this.result.checks.firebase.projectIdSource = 'next_public';
      this.result.checks.firebase.projectIdMatch = true;
    } else {
      this.result.checks.firebase.projectIdSource = 'missing';
      this.result.checks.firebase.projectIdMatch = false;
      this.addIssue('critical', 'firebase', 'No Firebase project ID found in environment variables');
    }
  }

  /**
   * Audit Azure-specific configuration
   */
  private async auditAzure(): Promise<void> {
    console.log('☁️  Auditing Azure configuration...');

    // Check Key Vault URI
    const keyVaultUri = process.env.AZURE_KEY_VAULT_URI;
    this.result.checks.azure.keyVaultUriPresent = !!keyVaultUri;

    if (keyVaultUri) {
      const keyVaultRegex = /^https:\/\/[a-z0-9-]+\.vault\.azure\.net\/?$/i;
      this.result.checks.azure.keyVaultUriFormat = keyVaultRegex.test(keyVaultUri) ? 'valid' : 'invalid';
      
      if (this.result.checks.azure.keyVaultUriFormat === 'invalid') {
        this.addIssue('warning', 'azure', 'Azure Key Vault URI format appears invalid');
      }
    } else {
      this.result.checks.azure.keyVaultUriFormat = 'missing';
      this.addIssue('info', 'azure', 'Azure Key Vault URI not configured - using environment variables only');
    }

    // Check if running in Azure App Service
    const websiteName = process.env.WEBSITE_SITE_NAME;
    const websiteResourceGroup = process.env.WEBSITE_RESOURCE_GROUP;
    this.result.checks.azure.appServiceEnvironment = !!(websiteName && websiteResourceGroup);
    
    // If in Azure App Service, managed identity should be expected
    this.result.checks.azure.managedIdentityExpected = this.result.checks.azure.appServiceEnvironment;

    if (this.result.checks.azure.appServiceEnvironment) {
      console.log(`  • Detected Azure App Service: ${websiteName} in ${websiteResourceGroup}`);
    }
  }

  /**
   * Audit general environment configuration
   */
  private async auditGeneral(): Promise<void> {
    console.log('⚙️  Auditing general configuration...');

    this.result.checks.general.nodeEnv = process.env.NODE_ENV || 'unknown';
    
    // Detect Next.js environment
    if (process.env.NODE_ENV === 'development') {
      this.result.checks.general.nextJsEnv = 'development';
    } else if (process.env.NODE_ENV === 'production') {
      this.result.checks.general.nextJsEnv = 'production';
    } else if (process.env.NODE_ENV === 'test') {
      this.result.checks.general.nextJsEnv = 'test';
    } else {
      this.result.checks.general.nextJsEnv = 'unknown';
      this.addIssue('warning', 'general', `Unknown NODE_ENV: ${process.env.NODE_ENV}`);
    }

    // Check for required packages
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      const requiredPackages = [
        'firebase-admin',
        'next',
        '@azure/identity',
        '@azure/keyvault-secrets'
      ];

      this.result.checks.general.packageVersions = {};
      let hasAllRequired = true;

      for (const pkg of requiredPackages) {
        const version = packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg];
        if (version) {
          this.result.checks.general.packageVersions[pkg] = version;
        } else {
          hasAllRequired = false;
          this.addIssue('critical', 'general', `Required package missing: ${pkg}`);
        }
      }

      this.result.checks.general.hasRequiredPackages = hasAllRequired;
    } catch (error) {
      this.addIssue('warning', 'general', 'Could not read package.json');
      this.result.checks.general.hasRequiredPackages = false;
      this.result.checks.general.packageVersions = {};
    }
  }

  /**
   * Generate recommendations based on issues found
   */
  private generateRecommendations(): void {
    const criticalIssues = this.result.issues.filter(i => i.severity === 'critical');
    const warningIssues = this.result.issues.filter(i => i.severity === 'warning');

    if (criticalIssues.length === 0 && warningIssues.length === 0) {
      this.result.recommendations.push('✅ All environment checks passed! Firebase configuration appears correct.');
    } else {
      if (criticalIssues.length > 0) {
        this.result.recommendations.push('🚨 CRITICAL: Address the following issues immediately:');
        criticalIssues.forEach(issue => {
          this.result.recommendations.push(`   • ${issue.message}`);
          if (issue.fix) {
            this.result.recommendations.push(`     Fix: ${issue.fix}`);
          }
        });
      }

      if (warningIssues.length > 0) {
        this.result.recommendations.push('⚠️  WARNINGS: Consider addressing these issues:');
        warningIssues.forEach(issue => {
          this.result.recommendations.push(`   • ${issue.message}`);
        });
      }

      // Specific recommendations for Azure App Service
      if (this.result.checks.azure.appServiceEnvironment) {
        this.result.recommendations.push('\n📘 Azure App Service specific recommendations:');
        this.result.recommendations.push('   • Check Application Settings in Azure Portal');
        this.result.recommendations.push('   • Verify Managed Identity has Key Vault access');
        this.result.recommendations.push('   • Use the debug endpoint: /api/debug/firebase-config');
        this.result.recommendations.push('   • Check Application Insights for detailed error logs');
      }
    }
  }

  /**
   * Calculate appropriate exit code based on issues
   */
  private calculateExitCode(): void {
    const criticalIssues = this.result.issues.filter(i => i.severity === 'critical');
    const warningIssues = this.result.issues.filter(i => i.severity === 'warning');

    if (criticalIssues.length > 0) {
      this.result.exitCode = 2; // Critical issues
    } else if (warningIssues.length > 0) {
      this.result.exitCode = 1; // Warning issues
    } else {
      this.result.exitCode = 0; // All good
    }
  }

  /**
   * Add an issue to the results
   */
  private addIssue(severity: Issue['severity'], category: Issue['category'], message: string, fix?: string, documentation?: string): void {
    this.result.issues.push({
      severity,
      category,
      message,
      fix,
      documentation
    });
  }
}

// CLI Interface
async function main() {
  const auditor = new EnvironmentAuditor();
  
  try {
    const result = await auditor.audit();
    
    // Output results
    console.log('\n' + '='.repeat(60));
    console.log('📊 ENVIRONMENT AUDIT RESULTS');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${result.timestamp}`);
    console.log(`Environment: ${result.environment}`);
    console.log(`Exit Code: ${result.exitCode}\n`);
    
    // Summary
    const criticalCount = result.issues.filter(i => i.severity === 'critical').length;
    const warningCount = result.issues.filter(i => i.severity === 'warning').length;
    const infoCount = result.issues.filter(i => i.severity === 'info').length;
    
    console.log('📈 Summary:');
    console.log(`   Critical Issues: ${criticalCount}`);
    console.log(`   Warnings: ${warningCount}`);
    console.log(`   Info: ${infoCount}\n`);
    
    // Detailed results
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
      console.log('🔍 Detailed Check Results:');
      console.log(JSON.stringify(result.checks, null, 2));
      console.log();
    }
    
    // Issues
    if (result.issues.length > 0) {
      console.log('🚨 Issues Found:');
      result.issues.forEach((issue, index) => {
        const icon = issue.severity === 'critical' ? '🔴' : 
                    issue.severity === 'warning' ? '🟡' : '🔵';
        console.log(`   ${index + 1}. ${icon} [${issue.severity.toUpperCase()}] ${issue.message}`);
        if (issue.fix) {
          console.log(`      💡 ${issue.fix}`);
        }
      });
      console.log();
    }
    
    // Recommendations
    console.log('💡 Recommendations:');
    result.recommendations.forEach(rec => console.log(rec));
    
    // JSON output option
    if (process.argv.includes('--json')) {
      console.log('\n' + '='.repeat(60));
      console.log('📄 JSON OUTPUT:');
      console.log('='.repeat(60));
      console.log(JSON.stringify(result, null, 2));
    }
    
    process.exit(result.exitCode);
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(3);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { EnvironmentAuditor, AuditResult };