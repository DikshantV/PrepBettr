"use server";

import { azureFunctionsClient } from '@/lib/services/azure-functions-client';

/**
 * Cloud Functions verification service
 * Uses Azure Functions as primary, Firebase Cloud Functions as fallback
 */
class CloudFunctionsVerificationService {
  private readonly CLOUD_FUNCTIONS_URL = process.env.FIREBASE_FUNCTIONS_URL || 
    `https://us-central1-${process.env.FIREBASE_PROJECT_ID}.cloudfunctions.net`;
  private readonly AZURE_FUNCTIONS_URL = process.env.AZURE_FUNCTIONS_URL;

  /**
   * Verify token using Azure Functions (primary) or Firebase Cloud Functions (fallback)
   */
  async verifyTokenWithCloudFunction(idToken: string, functionName: string = 'verifyToken'): Promise<CloudFunctionResult> {
    // Try Azure Functions first
    if (this.AZURE_FUNCTIONS_URL) {
      try {
        console.log('Attempting token verification via Azure Function');
        const azureResult = await azureFunctionsClient.verifyToken(idToken);
        
        if (azureResult.valid && azureResult.decoded) {
          return {
            success: true,
            data: {
              valid: true,
              decoded: azureResult.decoded,
              method: 'azure-function'
            },
            error: null
          };
        } else {
          throw new Error(azureResult.error || 'Azure Function verification failed');
        }
      } catch (azureError) {
        console.warn('Azure Function verification failed, falling back to Firebase:', azureError);
        // Continue to Firebase fallback
      }
    }
    
    // Fallback to Firebase Cloud Functions
    try {
      console.log('Attempting token verification via Firebase Cloud Function');
      const response = await fetch(`${this.CLOUD_FUNCTIONS_URL}/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // Send token in header
        },
        body: JSON.stringify({
          idToken,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: { ...result, method: 'firebase-cloud-function' },
        error: null
      };
    } catch (error) {
      console.error('Both Azure and Firebase Cloud Function verification failed:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify user permissions using Cloud Function
   */
  async verifyUserPermissions(idToken: string, requiredPermissions: string[]): Promise<PermissionResult> {
    try {
      const response = await fetch(`${this.CLOUD_FUNCTIONS_URL}/verifyPermissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          requiredPermissions,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Permission check failed: HTTP ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        hasPermissions: result.hasPermissions,
        permissions: result.permissions,
        error: null
      };
    } catch (error) {
      console.error('Permission verification failed:', error);
      return {
        success: false,
        hasPermissions: false,
        permissions: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}


// Types
interface CloudFunctionResult {
  success: boolean;
  data: any | null;
  error: string | null;
}

interface PermissionResult {
  success: boolean;
  hasPermissions: boolean;
  permissions: string[];
  error: string | null;
}

// Export singleton instance
export const cloudFunctionsVerification = new CloudFunctionsVerificationService();

// Helper functions
export async function verifyTokenWithCloudFunction(idToken: string): Promise<CloudFunctionResult> {
  return await cloudFunctionsVerification.verifyTokenWithCloudFunction(idToken);
}

export async function verifyUserPermissions(idToken: string, permissions: string[]): Promise<PermissionResult> {
  return await cloudFunctionsVerification.verifyUserPermissions(idToken, permissions);
}
