import { NextApiRequest, NextApiResponse } from 'next';
import { featureFlagsService } from '@/lib/services/feature-flags';
import { verifyAuthHeader } from '@/lib/shared/auth';

/**
 * API endpoint for feature flags - provides client-safe access to feature flags
 * without bundling server-only modules for the client
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Optional: Verify authentication if needed
    // const authResult = await verifyAuthHeader(req.headers.authorization);
    // if (!authResult.success) {
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }

    const refreshFlags = req.query.refresh === 'true';

    // Get feature flags from the service
    const flags = refreshFlags 
      ? await featureFlagsService.refreshFeatureFlags()
      : await featureFlagsService.getAllFeatureFlags();

    return res.status(200).json(flags);
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    
    // Return default flags on error
    return res.status(200).json({
      voiceInterview: false,
      premiumFeatures: false,
      newUI: false,
      rolloutStatus: {
        voiceInterview: false,
        premiumFeatures: false,
        newUI: false,
      },
    });
  }
}
