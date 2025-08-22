import { NextApiRequest, NextApiResponse } from 'next';

/**
 * API endpoint for unified configuration - provides client-safe access to config values
 * without bundling server-only modules for the client
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { key } = req.query;
    
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Config key is required' });
    }

    // Dynamic import to avoid bundling server-only modules on the client
    const { unifiedConfigService } = await import('@/lib/services/unified-config-service');

    // Get config value from the service
    const value = await unifiedConfigService.get(key);

    return res.status(200).json({ key, value });
  } catch (error) {
    console.error('Error fetching config:', error);
    
    // Return null value on error (let client handle defaults)
    return res.status(200).json({ 
      key: req.query.key, 
      value: null,
      error: 'Failed to fetch configuration' 
    });
  }
}
