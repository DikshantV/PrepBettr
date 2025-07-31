// lib/middleware/quota-middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { subscriptionService } from '@/lib/services/subscription-service';
import { UserUsageCounters } from '@/types/subscription';

interface QuotaCheckResult {
  canProceed: boolean;
  error?: string;
  upgradeMessage?: string;
  currentUsage?: any;
  plan?: string;
}

interface WithQuotaOptions {
  featureKey: keyof UserUsageCounters;
  limitFree: number;
  usageDocId?: string; // Optional custom usage document ID
}

/**
 * Quota enforcement middleware wrapper
 * Checks user plan and usage limits before allowing API access
 * Only enforces quotas in production environment
 */
export function withQuota(options: WithQuotaOptions) {
  return function(handler: (req: NextRequest, context?: { userId: string }) => Promise<NextResponse>) {
    return async function(req: NextRequest, context?: any): Promise<NextResponse> {
      try {
        // Skip quota enforcement in non-production environments
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEV MODE] Skipping quota enforcement for ${options.featureKey}`);
          
          // Still need to extract userId for handler context in dev mode
          const sessionCookie = req.cookies.get('session')?.value;
          if (sessionCookie) {
            const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
            if (verificationResult.success && verificationResult.decodedToken) {
              const userId = verificationResult.decodedToken.uid;
              const userContext = { userId, ...context };
              return await handler(req, userContext);
            }
          }
          
          // Fallback to handler without context in dev mode
          return await handler(req, context);
        }
        // Extract session cookie from request
        const sessionCookie = req.cookies.get('session')?.value;
        
        if (!sessionCookie) {
          return NextResponse.json(
            { 
              success: false,
              error: 'Authentication required',
              upgradeUrl: '/auth/signin'
            },
            { status: 401 }
          );
        }

        // Verify the session token
        const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
        
        if (!verificationResult.success || !verificationResult.decodedToken) {
          return NextResponse.json(
            { 
              success: false,
              error: 'Invalid session',
              details: verificationResult.error,
              upgradeUrl: '/auth/signin'
            },
            { status: 401 }
          );
        }

        const userId = verificationResult.decodedToken.uid;
        const customUsageDocId = options.usageDocId || userId;

        // Check quota and get user data
        console.log(`[QUOTA] Checking quota for user ${userId}, feature: ${options.featureKey}`);
        const quotaResult = await checkUserQuota(
          customUsageDocId,
          options.featureKey,
          options.limitFree
        );
        console.log(`[QUOTA] Quota check result:`, quotaResult);

        if (!quotaResult.canProceed) {
          // Return 402 Payment Required with upgrade CTA
          return NextResponse.json(
            {
              success: false,
              error: quotaResult.error,
              plan: quotaResult.plan,
              currentUsage: quotaResult.currentUsage,
              upgradeMessage: quotaResult.upgradeMessage,
              upgradeUrl: '/pricing',
              feature: options.featureKey
            },
            { status: 402 } // Payment Required
          );
        }

        // Execute the wrapped handler with user context
        const userContext = { userId, ...context };
        const response = await handler(req, userContext);

        // If the handler executed successfully, increment the usage counter
        if (response.status >= 200 && response.status < 300) {
          // Increment usage in background (don't await to avoid delaying response)
          incrementUsageCounter(customUsageDocId, options.featureKey)
            .catch(error => {
              console.error('Failed to increment usage counter:', error);
              // Don't fail the request if usage increment fails
            });
        }

        return response;

      } catch (error) {
        console.error('Quota middleware error:', error);
        return NextResponse.json(
          { 
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    };
  };
}

/**
 * Check if user can proceed based on their plan, current usage, email verification, and license key
 */
async function checkUserQuota(
  userId: string,
  feature: keyof UserUsageCounters,
  limitFree: number
): Promise<QuotaCheckResult> {
  try {
    // Use enhanced subscription service method that checks all access types
    const actionCheck = await subscriptionService.canPerformAction(userId, feature, true);
    
    if (!actionCheck.canPerform) {
      // Handle different types of restrictions
      if (actionCheck.emailVerificationRequired) {
        return {
          canProceed: false,
          error: 'Email verification required',
          upgradeMessage: 'Please verify your email address before using this feature. Check your inbox for a verification link.',
          plan: 'free'
        };
      }
      
      if (actionCheck.upgradeRequired) {
        return {
          canProceed: false,
          error: actionCheck.reason || `You've reached your ${getFeatureDisplayName(feature)} limit`,
          upgradeMessage: 'Please get a premium subscription.',
          plan: 'free'
        };
      }
      
      return {
        canProceed: false,
        error: actionCheck.reason || 'Access denied',
        plan: 'free'
      };
    }

    // Get detailed subscription status for response metadata
    const subscriptionStatus = await subscriptionService.getUserSubscriptionStatus(userId);
    
    return {
      canProceed: true,
      plan: subscriptionStatus.hasPremium ? 'premium' : 'free',
      currentUsage: subscriptionStatus.usage?.[feature]
    };

  } catch (error) {
    console.error('Error checking user quota:', error);
    // In case of error, be restrictive and deny access
    return {
      canProceed: false,
      error: 'Unable to verify usage limits. Please try again.'
    };
  }
}

/**
 * Increment usage counter in Firestore transaction
 */
async function incrementUsageCounter(
  userId: string,
  feature: keyof UserUsageCounters
): Promise<boolean> {
  try {
    return await subscriptionService.incrementUsage(userId, feature);
  } catch (error) {
    console.error('Failed to increment usage counter:', error);
    throw error;
  }
}

/**
 * Get human-readable feature name
 */
function getFeatureDisplayName(feature: keyof UserUsageCounters): string {
  const displayNames: Record<keyof UserUsageCounters, string> = {
    interviews: 'interview generation',
    resumeTailor: 'resume tailoring',
    autoApply: 'auto-apply job application',
    coverLetterGenerator: 'cover letter generation',
  };
  
  return displayNames[feature] || feature;
}

/**
 * Get upgrade message based on feature
 */
function getUpgradeMessage(
  feature: keyof UserUsageCounters,
  currentCount: number,
  limit: number
): string {
  const featureName = getFeatureDisplayName(feature);
  
  return `You've used ${currentCount}/${limit} ${featureName} requests this month. Upgrade to Premium for unlimited access and advanced features!`;
}


// Export types for use in other files
export type { WithQuotaOptions, QuotaCheckResult };
