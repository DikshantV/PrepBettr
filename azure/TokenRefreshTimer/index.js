const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');

module.exports = async function (context, myTimer) {
    const timeStamp = new Date().toISOString();
    
    if (myTimer.IsPastDue) {
        context.log('Token refresh timer is running late!');
    }
    
    context.log('Token refresh timer trigger function ran!', timeStamp);
    
    try {
        const keyVaultUri = process.env.AZURE_KEY_VAULT_URI;
        if (!keyVaultUri) {
            throw new Error('AZURE_KEY_VAULT_URI environment variable is required');
        }
        
        const secretClient = new SecretClient(keyVaultUri, new DefaultAzureCredential());
        
        // Get all token secrets that need refresh
        const secrets = [];
        for await (const secretProperties of secretClient.listPropertiesOfSecrets()) {
            if (secretProperties.name.includes('-tokens-')) {
                secrets.push(secretProperties.name);
            }
        }
        
        context.log(`Found ${secrets.length} token secrets to check for refresh`);
        
        let refreshedCount = 0;
        let errorCount = 0;
        
        // Process each token secret
        for (const secretName of secrets) {
            try {
                const secret = await secretClient.getSecret(secretName);
                if (!secret.value) continue;
                
                const tokens = JSON.parse(secret.value);
                const now = Date.now();
                const fiveMinutes = 5 * 60 * 1000;
                
                // Check if token expires within 5 minutes or is already expired
                if (tokens.expiresAt <= (now + fiveMinutes)) {
                    context.log(`Attempting to refresh token for: ${secretName}`);
                    
                    const [portal, , userId] = secretName.split('-');
                    
                    // Get Azure AD config for the portal
                    const configSecret = await secretClient.getSecret(`${portal}-azure-ad-config`);
                    if (!configSecret.value) {
                        context.log(`No Azure AD config found for portal: ${portal}`);
                        continue;
                    }
                    
                    const config = JSON.parse(configSecret.value);
                    
                    // Attempt to refresh the token
                    const refreshed = await refreshToken(tokens.refreshToken, config, portal);
                    
                    if (refreshed) {
                        // Store the refreshed tokens
                        const newTokens = {
                            accessToken: refreshed.access_token,
                            refreshToken: refreshed.refresh_token || tokens.refreshToken,
                            expiresAt: Date.now() + (refreshed.expires_in * 1000),
                            tokenType: refreshed.token_type || 'Bearer',
                            scope: refreshed.scope || tokens.scope,
                        };
                        
                        await secretClient.setSecret(secretName, JSON.stringify(newTokens));
                        
                        context.log(`Successfully refreshed token for: ${secretName}`);
                        refreshedCount++;
                    } else {
                        context.log(`Failed to refresh token for: ${secretName}`);
                        errorCount++;
                    }
                } else {
                    context.log(`Token for ${secretName} is still valid, expires at: ${new Date(tokens.expiresAt).toISOString()}`);
                }
            } catch (error) {
                context.log(`Error processing token ${secretName}:`, error.message);
                errorCount++;
            }
        }
        
        context.log(`Token refresh completed. Refreshed: ${refreshedCount}, Errors: ${errorCount}`);
        
    } catch (error) {
        context.log('Error in token refresh timer:', error);
        throw error;
    }
};

/**
 * Refresh an OAuth token
 */
async function refreshToken(refreshToken, config, portal) {
    const tokenEndpoint = getTokenEndpoint(portal);
    
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
            console.error(`Token refresh failed: ${response.status} ${response.statusText}`);
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error('Token refresh error:', error);
        return null;
    }
}

/**
 * Get token endpoint for the portal
 */
function getTokenEndpoint(portal) {
    switch (portal) {
        case 'linkedin':
            return 'https://www.linkedin.com/oauth/v2/accessToken';
        case 'wellfound':
            return 'https://api.wellfound.com/oauth/token';
        default:
            throw new Error(`Unknown portal: ${portal}`);
    }
}
