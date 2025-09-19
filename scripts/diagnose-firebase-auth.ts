#!/usr/bin/env tsx

/**
 * Comprehensive Firebase Auth Diagnostic Script
 * 
 * This script systematically checks all possible causes of auth/internal-error:
 * 1. Firebase project configuration
 * 2. API key validity
 * 3. Authorized domains
 * 4. Google OAuth client setup
 * 5. Browser compatibility issues
 * 6. Network connectivity
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables
config({ path: '.env.local' });

interface DiagnosticResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

class FirebaseAuthDiagnostic {
  private results: DiagnosticResult[] = [];
  private firebaseConfig: any;

  constructor() {
    this.firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  }

  private async addResult(category: string, test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
    this.results.push({ category, test, status, message, details });
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${emoji} [${category}] ${test}: ${message}`);
    if (details) console.log(`   Details:`, details);
  }

  async checkEnvironmentVariables() {
    const category = 'Environment';
    
    const requiredVars = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID'
    ];

    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value) {
        await this.addResult(category, varName, 'FAIL', 'Missing required environment variable');
      } else if (varName === 'NEXT_PUBLIC_FIREBASE_API_KEY' && !value.startsWith('AIza')) {
        await this.addResult(category, varName, 'FAIL', 'Invalid Firebase API key format', { preview: `${value.substring(0, 10)}...` });
      } else {
        await this.addResult(category, varName, 'PASS', 'Environment variable present', { 
          preview: varName.includes('API_KEY') ? `${value.substring(0, 10)}...` : value 
        });
      }
    }
  }

  async checkFirebaseProjectConfig() {
    const category = 'Firebase Project';
    
    if (!this.firebaseConfig.apiKey || !this.firebaseConfig.projectId) {
      await this.addResult(category, 'Config Check', 'FAIL', 'Missing API key or project ID');
      return;
    }

    try {
      // Test Firebase REST API connectivity
      const response = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${this.firebaseConfig.projectId}?key=${this.firebaseConfig.apiKey}`);
      
      if (response.ok) {
        const data = await response.json();
        await this.addResult(category, 'Project API Access', 'PASS', 'Firebase project accessible via REST API', {
          projectNumber: data.projectNumber,
          state: data.state
        });
      } else if (response.status === 403) {
        await this.addResult(category, 'Project API Access', 'FAIL', 'API key lacks permissions for project access', {
          status: response.status,
          statusText: response.statusText
        });
      } else if (response.status === 404) {
        await this.addResult(category, 'Project API Access', 'FAIL', 'Project not found - check project ID', {
          status: response.status,
          statusText: response.statusText
        });
      } else {
        await this.addResult(category, 'Project API Access', 'WARN', 'Unexpected response from Firebase API', {
          status: response.status,
          statusText: response.statusText
        });
      }
    } catch (error) {
      await this.addResult(category, 'Project API Access', 'FAIL', 'Network error connecting to Firebase', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async checkAuthConfiguration() {
    const category = 'Firebase Auth';
    
    try {
      // Check Firebase Auth configuration
      const authConfigUrl = `https://identitytoolkit.googleapis.com/v1/projects/${this.firebaseConfig.projectId}/config?key=${this.firebaseConfig.apiKey}`;
      const response = await fetch(authConfigUrl);
      
      if (response.ok) {
        const config = await response.json();
        await this.addResult(category, 'Auth Config', 'PASS', 'Firebase Auth configuration accessible', {
          signIn: config.signIn || {},
          authorizedDomains: config.authorizedDomains || []
        });

        // Check if localhost is authorized
        const authorizedDomains = config.authorizedDomains || [];
        const hasLocalhost = authorizedDomains.some((domain: string) => 
          domain.includes('localhost') || domain.includes('127.0.0.1')
        );
        
        if (hasLocalhost) {
          await this.addResult(category, 'Localhost Authorization', 'PASS', 'Localhost is in authorized domains');
        } else {
          await this.addResult(category, 'Localhost Authorization', 'WARN', 'Localhost not found in authorized domains', {
            authorizedDomains
          });
        }

        // Check Google provider
        const providers = config.signIn?.allowedProviders || [];
        const hasGoogle = providers.includes('google.com');
        
        if (hasGoogle) {
          await this.addResult(category, 'Google Provider', 'PASS', 'Google sign-in provider is enabled');
        } else {
          await this.addResult(category, 'Google Provider', 'FAIL', 'Google sign-in provider not enabled', {
            enabledProviders: providers
          });
        }

      } else {
        await this.addResult(category, 'Auth Config', 'FAIL', `Cannot access Firebase Auth config: ${response.status}`, {
          status: response.status,
          statusText: response.statusText
        });
      }
    } catch (error) {
      await this.addResult(category, 'Auth Config', 'FAIL', 'Error checking Firebase Auth configuration', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async checkGoogleOAuthConfig() {
    const category = 'Google OAuth';
    
    // Check if Google OAuth client ID is configured
    const googleClientId = process.env.GOOGLE_CLIENT_ID_SUFFIX || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    
    if (googleClientId) {
      await this.addResult(category, 'OAuth Client ID', 'PASS', 'Google OAuth Client ID found', {
        preview: `${googleClientId.substring(0, 20)}...`
      });
      
      // Validate client ID format
      if (googleClientId.includes('.apps.googleusercontent.com')) {
        await this.addResult(category, 'Client ID Format', 'PASS', 'Client ID has correct format');
      } else {
        await this.addResult(category, 'Client ID Format', 'WARN', 'Client ID format may be incorrect', {
          expected: '*.apps.googleusercontent.com',
          actual: googleClientId
        });
      }
    } else {
      await this.addResult(category, 'OAuth Client ID', 'WARN', 'No Google OAuth Client ID found in environment');
    }
  }

  async checkBrowserCompatibility() {
    const category = 'Browser Compatibility';
    
    // Check Node.js version compatibility
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion >= 18) {
      await this.addResult(category, 'Node.js Version', 'PASS', `Node.js ${nodeVersion} is compatible`);
    } else {
      await this.addResult(category, 'Node.js Version', 'WARN', `Node.js ${nodeVersion} may have compatibility issues`);
    }

    // Check for potential SSL/TLS issues
    const sslEnvVars = [
      'NODE_OPTIONS',
      'GRPC_VERBOSITY'
    ];
    
    for (const varName of sslEnvVars) {
      const value = process.env[varName];
      if (value) {
        await this.addResult(category, `${varName} Setting`, 'PASS', `${varName} configured`, { value });
      }
    }
  }

  async checkPackageVersions() {
    const category = 'Dependencies';
    
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      const firebaseVersion = packageJson.dependencies?.firebase;
      const nextVersion = packageJson.dependencies?.next;
      
      if (firebaseVersion) {
        await this.addResult(category, 'Firebase SDK', 'PASS', `Firebase SDK version: ${firebaseVersion}`);
        
        // Check for known incompatible versions
        if (firebaseVersion.includes('10.') || firebaseVersion.includes('11.')) {
          await this.addResult(category, 'Firebase Compatibility', 'PASS', 'Using Firebase SDK v10+ with modular API');
        } else {
          await this.addResult(category, 'Firebase Compatibility', 'WARN', 'Consider upgrading to Firebase SDK v10+');
        }
      }

      if (nextVersion) {
        await this.addResult(category, 'Next.js Version', 'PASS', `Next.js version: ${nextVersion}`);
      }
      
    } catch (error) {
      await this.addResult(category, 'Package Check', 'FAIL', 'Could not read package.json', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async checkNetworkConnectivity() {
    const category = 'Network';
    
    const endpoints = [
      'https://firebase.googleapis.com',
      'https://identitytoolkit.googleapis.com',
      'https://accounts.google.com'
    ];

    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        const response = await fetch(endpoint, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        const duration = Date.now() - start;
        
        await this.addResult(category, `${endpoint} Connectivity`, 'PASS', `Reachable (${duration}ms)`, {
          status: response.status,
          duration: `${duration}ms`
        });
      } catch (error) {
        await this.addResult(category, `${endpoint} Connectivity`, 'FAIL', 'Unreachable', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  async runDiagnostics() {
    console.log('🔍 Starting Firebase Auth Diagnostic...\n');
    
    await this.checkEnvironmentVariables();
    await this.checkFirebaseProjectConfig();
    await this.checkAuthConfiguration();
    await this.checkGoogleOAuthConfig();
    await this.checkBrowserCompatibility();
    await this.checkPackageVersions();
    await this.checkNetworkConnectivity();

    console.log('\n📊 Diagnostic Summary:');
    console.log('='.repeat(50));
    
    const summary = {
      PASS: this.results.filter(r => r.status === 'PASS').length,
      WARN: this.results.filter(r => r.status === 'WARN').length,
      FAIL: this.results.filter(r => r.status === 'FAIL').length
    };

    console.log(`✅ PASS: ${summary.PASS}`);
    console.log(`⚠️  WARN: ${summary.WARN}`);
    console.log(`❌ FAIL: ${summary.FAIL}`);

    const criticalIssues = this.results.filter(r => r.status === 'FAIL');
    if (criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues to Fix:');
      criticalIssues.forEach(issue => {
        console.log(`❌ [${issue.category}] ${issue.test}: ${issue.message}`);
      });
    }

    const warnings = this.results.filter(r => r.status === 'WARN');
    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings to Review:');
      warnings.forEach(warning => {
        console.log(`⚠️  [${warning.category}] ${warning.test}: ${warning.message}`);
      });
    }

    return {
      summary,
      criticalIssues: criticalIssues.length,
      warnings: warnings.length,
      total: this.results.length
    };
  }
}

async function main() {
  const diagnostic = new FirebaseAuthDiagnostic();
  const results = await diagnostic.runDiagnostics();
  
  if (results.criticalIssues > 0) {
    console.log('\n💡 Recommended Actions:');
    console.log('1. Fix critical issues listed above');
    console.log('2. Verify Firebase project configuration in Firebase Console');
    console.log('3. Check Google OAuth client configuration in Google Cloud Console');
    console.log('4. Ensure localhost is in Firebase Auth authorized domains');
    process.exit(1);
  } else if (results.warnings > 0) {
    console.log('\n💡 Everything looks good! Review warnings if auth issues persist.');
    process.exit(0);
  } else {
    console.log('\n🎉 All diagnostics passed! Firebase Auth should be working correctly.');
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(console.error);
}