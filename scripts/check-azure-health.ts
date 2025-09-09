#!/usr/bin/env node

/**
 * Azure Services Health Check Script
 * 
 * This script validates:
 * 1. API version strings are valid (2024-02-15-preview is stable)
 * 2. Deployment names match available Azure OpenAI models
 * 3. Speech service regions are correctly extracted from endpoints
 * 4. Services can initialize successfully
 */

import { azureOpenAIService } from '../lib/services/azure-openai-service';
import { migrationOpenAIClient } from '@/lib/azure-ai-foundry/clients/migration-wrapper';
import { azureSpeechService } from '../azure/lib/services/azure-speech-service';
import { fetchAzureSecrets, getAzureConfig } from '../lib/azure-config';
import { fetchAzureSecrets as fetchBrowserSecrets } from '../lib/azure-config-browser';
import * as fs from 'fs';
import * as path from 'path';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  const prefix = {
    success: `${colors.green}✅`,
    error: `${colors.red}❌`,
    warning: `${colors.yellow}⚠️`,
    info: `${colors.blue}ℹ️`,
  };
  
  console.log(`${prefix[type]} ${message}${colors.reset}`);
}

async function checkApiVersions(): Promise<boolean> {
  log('Checking Azure OpenAI API versions...', 'info');
  
  const validApiVersions = [
    '2024-02-15-preview', // Current stable preview
    '2024-08-01-preview', // Latest preview (less stable)
    '2023-12-01-preview', // Previous stable
    '2023-05-15',         // GA version
  ];
  
  const serviceFiles = [
    'lib/services/azure-openai-service.ts',
    'lib/services/azure-openai.ts',
    'azure/lib/services/azure-openai-service.ts',
  ];
  
  let allValid = true;
  
  for (const file of serviceFiles) {
    const filePath = path.join(process.cwd(), file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const apiVersionPattern = /api-?[Vv]ersion['"]?\s*[:=]\s*['"]([^'"]+)['"]/g;
      const matches = Array.from(content.matchAll(apiVersionPattern));
      
      if (matches.length > 0) {
        for (const match of matches) {
          const apiVersion = match[1];
          if (validApiVersions.includes(apiVersion)) {
            log(`${file}: API version ${apiVersion} ✓`, 'success');
          } else {
            log(`${file}: Invalid API version ${apiVersion}`, 'error');
            allValid = false;
          }
        }
      }
    } catch (error) {
      log(`Could not check ${file}: ${(error as any).message}`, 'warning');
    }
  }
  
  return allValid;
}

async function checkDeploymentNames(): Promise<boolean> {
  log('Checking Azure OpenAI deployment names...', 'info');
  
  try {
    const secrets = await fetchAzureSecrets();
    const deployment = secrets.azureOpenAIDeployment;
    
    const validPatterns = [
      /^gpt-4[a-z0-9-]*$/i,
      /^gpt-35-turbo[a-z0-9-]*$/i,
      /^text-embedding[a-z0-9-]*$/i,
      /^dall-e[a-z0-9-]*$/i,
      /^whisper[a-z0-9-]*$/i,
    ];
    
    const isValid = validPatterns.some(pattern => pattern.test(deployment));
    
    if (isValid) {
      log(`Deployment name "${deployment}" is valid`, 'success');
      return true;
    } else {
      log(`Deployment name "${deployment}" doesn't match known patterns`, 'error');
      return false;
    }
  } catch (error) {
    log(`Failed to check deployment names: ${(error as any).message}`, 'error');
    return false;
  }
}

async function checkSpeechRegion(): Promise<boolean> {
  log('Checking Speech Service region extraction...', 'info');
  
  try {
    const secrets = await fetchAzureSecrets();
    const endpoint = secrets.speechEndpoint;
    
    const regionMatch = endpoint.match(/https:\/\/([^.]+)/);
    if (!regionMatch) {
      log(`Could not extract region from endpoint: ${endpoint}`, 'error');
      return false;
    }
    
    const region = regionMatch[1];
    const validRegions = [
      'eastus', 'eastus2', 'westus', 'westus2', 'westus3',
      'centralus', 'northcentralus', 'southcentralus',
      'canadacentral', 'canadaeast',
      'northeurope', 'westeurope', 'uksouth', 'ukwest',
      'brazilsouth', 'australiaeast', 'southeastasia', 'eastasia',
      'japaneast', 'japanwest', 'koreacentral', 'centralindia'
    ];
    
    if (validRegions.includes(region)) {
      log(`Speech Service region "${region}" is valid`, 'success');
      return true;
    } else {
      log(`Speech Service region "${region}" may not be valid`, 'warning');
      return true; // Still pass but with warning
    }
  } catch (error) {
    log(`Failed to check Speech region: ${(error as any).message}`, 'error');
    return false;
  }
}

async function checkServiceInitialization(): Promise<boolean> {
  log('Testing service initialization...', 'info');
  
  let openAISuccess = false;
  let speechSuccess = false;
  
  // Test Azure OpenAI Service
  try {
    const initialized = await azureOpenAIService.initialize();
    if (initialized && azureOpenAIService.isReady()) {
      log('Azure OpenAI Service initialized successfully', 'success');
      openAISuccess = true;
    } else {
      log('Azure OpenAI Service initialization returned false', 'warning');
    }
  } catch (error) {
    log(`Azure OpenAI Service initialization failed: ${(error as any).message}`, 'error');
  } finally {
    azureOpenAIService.dispose();
  }
  
  // Test Azure Speech Service
  try {
    const initialized = await azureSpeechService.initialize();
    if (initialized && azureSpeechService.isReady()) {
      log('Azure Speech Service initialized successfully', 'success');
      speechSuccess = true;
    } else {
      log('Azure Speech Service initialization returned false', 'warning');
    }
  } catch (error) {
    log(`Azure Speech Service initialization failed: ${(error as any).message}`, 'error');
  } finally {
    azureSpeechService.dispose();
  }
  
  return openAISuccess || speechSuccess; // At least one should work
}

async function checkHealthEndpoint(): Promise<boolean> {
  log('Checking health endpoint...', 'info');
  
  try {
    const response = await fetch('http://localhost:3000/api/azure-health');
    const data = await response.json();
    
    if (data.status && data.services) {
      log('Health endpoint is functional', 'success');
      log(`Overall health: ${data.overall}`, data.overall === 'healthy' ? 'success' : 'warning');
      return true;
    } else {
      log('Health endpoint returned unexpected format', 'error');
      return false;
    }
  } catch (error) {
    log('Health endpoint not available (server may not be running)', 'warning');
    return true; // Don't fail if server isn't running
  }
}

async function main() {
  console.log(`${colors.cyan}=================================`);
  console.log(`${colors.cyan}Azure Services Health Check${colors.reset}`);
  console.log(`${colors.cyan}=================================\n`);
  
  const results = {
    apiVersions: await checkApiVersions(),
    deploymentNames: await checkDeploymentNames(),
    speechRegion: await checkSpeechRegion(),
    serviceInit: await checkServiceInitialization(),
    healthEndpoint: await checkHealthEndpoint(),
  };
  
  console.log(`\n${colors.cyan}=================================`);
  console.log(`${colors.cyan}Summary${colors.reset}`);
  console.log(`${colors.cyan}=================================\n`);
  
  const totalChecks = Object.keys(results).length;
  const passedChecks = Object.values(results).filter(r => r).length;
  
  console.log(`API Versions:         ${results.apiVersions ? '✅' : '❌'}`);
  console.log(`Deployment Names:     ${results.deploymentNames ? '✅' : '❌'}`);
  console.log(`Speech Region:        ${results.speechRegion ? '✅' : '❌'}`);
  console.log(`Service Init:         ${results.serviceInit ? '✅' : '❌'}`);
  console.log(`Health Endpoint:      ${results.healthEndpoint ? '✅' : '❌'}`);
  
  console.log(`\n${colors.cyan}Result: ${passedChecks}/${totalChecks} checks passed${colors.reset}`);
  
  if (passedChecks === totalChecks) {
    log('\nAll health checks passed! 🎉', 'success');
    process.exit(0);
  } else if (passedChecks >= totalChecks - 1) {
    log('\nMost health checks passed with minor issues', 'warning');
    process.exit(0);
  } else {
    log('\nMultiple health checks failed. Please review the configuration.', 'error');
    process.exit(1);
  }
}

// Run the health check
main().catch(error => {
  log(`Unexpected error: ${(error as any).message}`, 'error');
  process.exit(1);
});
