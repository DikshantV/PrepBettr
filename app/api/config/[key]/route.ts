/**
 * GET /api/config/[key]
 * 
 * Unified configuration API endpoint for feature flags and app settings.
 * Used by useUnifiedConfig hook for client-side configuration access.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Route parameters
 */
interface RouteParams {
  key: string;
}

/**
 * Response schema
 */
interface ConfigResponse {
  key: string;
  value: any;
  source: 'default' | 'environment' | 'azure' | 'firebase';
  success: boolean;
  error?: string;
}

/**
 * Default configuration values
 * This acts as fallback when external configuration services are unavailable
 */
const DEFAULT_CONFIG = {
  // Feature flags
  'features.voiceInterviewV2': false,
  'features.autoApplyAzure': false,
  'features.voiceInterview': true,
  'features.premiumFeatures': true,
  'features.newUI': false,
  
  // Application core settings
  'core.app.environment': process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
  'core.app.version': '1.0.0',
  'core.app.debug': process.env.ENVIRONMENT === 'development',
  'core.app.maintenanceMode': false,
  
  // Usage quotas (server-side only, safe to expose limits)
  'quotas.freeInterviews': 3,
  'quotas.freeResumes': 5,
  'quotas.premiumInterviews': 50,
  
  // Performance settings
  'perf.cacheTimeout': 300000, // 5 minutes
  'perf.maxRetries': 3,
  'perf.requestTimeout': 30000, // 30 seconds
} as const;

/**
 * Validate configuration key format
 */
function validateConfigKey(key: string): { isValid: boolean; error?: string } {
  if (!key || typeof key !== 'string') {
    return { isValid: false, error: 'Configuration key is required' };
  }

  if (key.length > 100) {
    return { isValid: false, error: 'Configuration key too long' };
  }

  // Allow alphanumeric, dots, underscores, hyphens
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    return { isValid: false, error: 'Invalid characters in configuration key' };
  }

  return { isValid: true };
}

/**
 * Get configuration value with fallback hierarchy
 */
async function getConfigValue(key: string): Promise<{
  value: any;
  source: 'default' | 'environment' | 'azure' | 'firebase';
}> {
  // 1. Try Azure App Configuration (if available in production)
  if (process.env.ENVIRONMENT === 'production') {
    try {
      // In a real implementation, this would use Azure App Configuration SDK
      // For now, we'll use environment variables as a proxy
      const envKey = key.replace(/\./g, '_').toUpperCase();
      const envValue = process.env[envKey];
      
      if (envValue !== undefined) {
        // Parse boolean and numeric values
        let parsedValue: any = envValue;
        if (envValue === 'true') parsedValue = true;
        else if (envValue === 'false') parsedValue = false;
        else if (/^\d+$/.test(envValue)) parsedValue = parseInt(envValue, 10);
        else if (/^\d+\.\d+$/.test(envValue)) parsedValue = parseFloat(envValue);
        
        return { value: parsedValue, source: 'environment' };
      }
    } catch (error) {
      console.warn(`Failed to fetch config from environment for key ${key}:`, error);
    }
  }

  // 2. Try Firebase Remote Config (fallback)
  try {
    // For client-side feature flags, we can use Firebase Remote Config
    // This would require the Firebase Admin SDK in a real implementation
    // For now, we'll skip this step
  } catch (error) {
    console.warn(`Failed to fetch config from Firebase for key ${key}:`, error);
  }

  // 3. Use default configuration
  const defaultValue = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG];
  if (defaultValue !== undefined) {
    return { value: defaultValue, source: 'default' };
  }

  // 4. Return undefined for unknown keys
  return { value: undefined, source: 'default' };
}

/**
 * GET handler for configuration values
 */
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse<ConfigResponse>> {
  try {
    const key = decodeURIComponent(params.key);
    
    // Validate configuration key
    const keyValidation = validateConfigKey(key);
    if (!keyValidation.isValid) {
      return NextResponse.json({
        key,
        value: undefined,
        source: 'default',
        success: false,
        error: keyValidation.error
      }, { status: 400 });
    }

    // Get configuration value
    const { value, source } = await getConfigValue(key);

    return NextResponse.json({
      key,
      value,
      source,
      success: true
    });

  } catch (error) {
    console.error('Failed to get configuration value:', error);
    
    return NextResponse.json({
      key: params.key || 'unknown',
      value: undefined,
      source: 'default',
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * POST handler for updating configuration values (admin only)
 * This would typically require authentication and authorization
 */
export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse> {
  // TODO: Add authentication middleware
  // TODO: Add authorization checks for admin users
  // TODO: Implement configuration updates to Azure App Configuration
  
  return NextResponse.json({
    error: 'Configuration updates not yet implemented'
  }, { status: 501 });
}
