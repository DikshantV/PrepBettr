"use server";

/**
 * Cloud Functions verification service
 * Deploy verification logic to Firebase Cloud Functions for additional security
 */
class CloudFunctionsVerificationService {
  private readonly CLOUD_FUNCTIONS_URL = process.env.FIREBASE_FUNCTIONS_URL || 
    `https://us-central1-${process.env.FIREBASE_PROJECT_ID}.cloudfunctions.net`;

  /**
   * Verify token using deployed Cloud Function
   */
  async verifyTokenWithCloudFunction(idToken: string, functionName: string = 'verifyToken'): Promise<CloudFunctionResult> {
    try {
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
        data: result,
        error: null
      };
    } catch (error) {
      console.error('Cloud Function verification failed:', error);
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
