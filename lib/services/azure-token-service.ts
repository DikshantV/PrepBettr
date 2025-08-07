import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import Bottleneck from 'bottleneck';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: 'Bearer';
  scope?: string;
}

export interface AzureADConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}

class AzureTokenService {
  private secretClient: SecretClient;
  private rateLimiter: Bottleneck;
  private tokenCache: Map<string, OAuthTokens> = new Map();

  constructor() {
    const keyVaultUri = process.env.AZURE_KEY_VAULT_URI;
    if (!keyVaultUri) {
      throw new Error('AZURE_KEY_VAULT_URI environment variable is required');
    }

    this.secretClient = new SecretClient(keyVaultUri, new DefaultAzureCredential());
    
    // Rate limiter for Azure Key Vault operations
    this.rateLimiter = new Bottleneck({
      minTime: 100, // Minimum 100ms between requests
      maxConcurrent: 10,
      reservoir: 100, // 100 requests per reservoir
      reservoirRefreshAmount: 100,
      reservoirRefreshInterval: 60 * 1000, // Refresh every minute
    });
  }

  /**
   * Store OAuth tokens securely in Azure Key Vault
   */
  async storeTokens(portal: 'linkedin' | 'wellfound', userId: string, tokens: OAuthTokens): Promise<void> {
    const secretName = `${portal}-tokens-${userId}`;
    
    try {
      await this.rateLimiter.schedule(async () => {
        await this.secretClient.setSecret(secretName, JSON.stringify(tokens));
      });
      
      // Update cache
      this.tokenCache.set(`${portal}-${userId}`, tokens);
      
      console.log(`Stored ${portal} tokens for user ${userId}`);
    } catch (error) {
      console.error(`Error storing ${portal} tokens for user ${userId}:`, error);
      throw new Error(`Failed to store OAuth tokens: ${error}`);
    }
  }

  /**
   * Retrieve OAuth tokens from Azure Key Vault
   */
  async getTokens(portal: 'linkedin' | 'wellfound', userId: string): Promise<OAuthTokens | null> {
    const cacheKey = `${portal}-${userId}`;
    
    // Check cache first
    const cachedTokens = this.tokenCache.get(cacheKey);
    if (cachedTokens && cachedTokens.expiresAt > Date.now()) {
      return cachedTokens;
    }

    const secretName = `${portal}-tokens-${userId}`;
    
    try {
      const result = await this.rateLimiter.schedule(async () => {
        return await this.secretClient.getSecret(secretName);
      });
      
      if (result.value) {
        const tokens: OAuthTokens = JSON.parse(result.value);
        
        // Update cache
        this.tokenCache.set(cacheKey, tokens);
        
        return tokens;
      }
      
      return null;
    } catch (error) {
      console.error(`Error retrieving ${portal} tokens for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Check if tokens need refresh (expires within 5 minutes)
   */
  needsRefresh(tokens: OAuthTokens): boolean {
    const fiveMinutes = 5 * 60 * 1000;
    return tokens.expiresAt <= (Date.now() + fiveMinutes);
  }

  /**
   * Refresh OAuth tokens using refresh token
   */
  async refreshTokens(
    portal: 'linkedin' | 'wellfound',
    userId: string,
    refreshToken: string,
    config: AzureADConfig
  ): Promise<OAuthTokens | null> {
    const tokenEndpoint = this.getTokenEndpoint(portal);
    
    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      const newTokens: OAuthTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: Date.now() + (data.expires_in * 1000),
        tokenType: data.token_type || 'Bearer',
        scope: data.scope,
      };

      // Store the refreshed tokens
      await this.storeTokens(portal, userId, newTokens);
      
      return newTokens;
    } catch (error) {
      console.error(`Error refreshing ${portal} tokens:`, error);
      return null;
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(
    portal: 'linkedin' | 'wellfound',
    userId: string,
    config: AzureADConfig
  ): Promise<string | null> {
    const tokens = await this.getTokens(portal, userId);
    
    if (!tokens) {
      return null;
    }

    if (this.needsRefresh(tokens)) {
      const refreshedTokens = await this.refreshTokens(portal, userId, tokens.refreshToken, config);
      return refreshedTokens?.accessToken || null;
    }

    return tokens.accessToken;
  }

  /**
   * Store Azure AD app configuration
   */
  async storeAzureADConfig(portal: 'linkedin' | 'wellfound', config: AzureADConfig): Promise<void> {
    const secretName = `${portal}-azure-ad-config`;
    
    try {
      await this.rateLimiter.schedule(async () => {
        await this.secretClient.setSecret(secretName, JSON.stringify(config));
      });
      
      console.log(`Stored Azure AD config for ${portal}`);
    } catch (error) {
      console.error(`Error storing Azure AD config for ${portal}:`, error);
      throw error;
    }
  }

  /**
   * Get Azure AD app configuration
   */
  async getAzureADConfig(portal: 'linkedin' | 'wellfound'): Promise<AzureADConfig | null> {
    const secretName = `${portal}-azure-ad-config`;
    
    try {
      const result = await this.rateLimiter.schedule(async () => {
        return await this.secretClient.getSecret(secretName);
      });
      
      if (result.value) {
        return JSON.parse(result.value) as AzureADConfig;
      }
      
      return null;
    } catch (error) {
      console.error(`Error retrieving Azure AD config for ${portal}:`, error);
      return null;
    }
  }

  /**
   * Delete user tokens (for logout/revocation)
   */
  async deleteTokens(portal: 'linkedin' | 'wellfound', userId: string): Promise<void> {
    const secretName = `${portal}-tokens-${userId}`;
    const cacheKey = `${portal}-${userId}`;
    
    try {
      await this.rateLimiter.schedule(async () => {
        await this.secretClient.beginDeleteSecret(secretName);
      });
      
      // Remove from cache
      this.tokenCache.delete(cacheKey);
      
      console.log(`Deleted ${portal} tokens for user ${userId}`);
    } catch (error) {
      console.error(`Error deleting ${portal} tokens for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Get token endpoint for the portal
   */
  private getTokenEndpoint(portal: 'linkedin' | 'wellfound'): string {
    switch (portal) {
      case 'linkedin':
        return 'https://www.linkedin.com/oauth/v2/accessToken';
      case 'wellfound':
        return 'https://api.wellfound.com/oauth/token'; // Note: Wellfound uses AngelList API
      default:
        throw new Error(`Unknown portal: ${portal}`);
    }
  }
}

// Singleton instance
let azureTokenServiceInstance: AzureTokenService | null = null;

export function getAzureTokenService(): AzureTokenService {
  if (!azureTokenServiceInstance) {
    azureTokenServiceInstance = new AzureTokenService();
  }
  return azureTokenServiceInstance;
}

export { AzureTokenService };
