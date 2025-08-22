/**
 * Firebase Remote Config Adapter
 * 
 * Adapter for Firebase Remote Config service
 * This is a stub since Firebase services are being phased out
 */

import { IConfigService } from '../../shared/interfaces';

export class FirebaseRemoteConfigAdapter implements IConfigService {
  async get(key: string, defaultValue?: any): Promise<any> {
    console.warn('Firebase Remote Config Adapter is deprecated - use Azure App Configuration instead');
    return defaultValue;
  }

  async set(key: string, value: any, environment?: string): Promise<void> {
    throw new Error('Firebase Remote Config Adapter deprecated - use Azure App Configuration');
  }

  async getAll(prefix?: string): Promise<Record<string, any>> {
    console.warn('Firebase Remote Config Adapter is deprecated - use Azure App Configuration instead');
    return {};
  }

  async refresh(): Promise<void> {
    console.warn('Firebase Remote Config Adapter is deprecated - use Azure App Configuration instead');
  }

  subscribe(key: string, callback: (value: any) => void): () => void {
    console.warn('Firebase Remote Config Adapter is deprecated - use Azure App Configuration instead');
    return () => {};
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return {
      healthy: false,
      message: 'Firebase Remote Config Adapter is deprecated'
    };
  }
}
