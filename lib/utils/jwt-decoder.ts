/**
 * Simple JWT decoder for Firebase ID tokens
 * This bypasses Firebase Admin SDK to avoid SSL/gRPC issues
 */

interface DecodedToken {
  uid?: string;
  user_id?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  exp: number;
  iat: number;
  aud: string;
  iss: string;
  [key: string]: any; // Allow additional properties
}

export function decodeFirebaseToken(token: string): DecodedToken | null {
  try {
    // Split the token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid token format');
      return null;
    }

    // Decode the payload (middle part)
    const payload = parts[1];
    // Add padding if needed
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    
    // Decode from base64
    const decoded = Buffer.from(paddedPayload, 'base64url').toString('utf8');
    const tokenData = JSON.parse(decoded) as DecodedToken;

    // Basic validation - check for user_id field (Firebase uses this)
    if (!tokenData.uid && !tokenData.user_id && !tokenData.sub) {
      console.error('Invalid token data - missing user ID');
      return null;
    }
    
    if (!tokenData.exp) {
      console.error('Invalid token data - missing expiration');
      return null;
    }
    
    if (!tokenData.aud) {
      console.error('Invalid token data - missing audience');
      return null;
    }
    
    // Normalize user ID field
    if (!tokenData.uid && tokenData.user_id) {
      tokenData.uid = tokenData.user_id;
    } else if (!tokenData.uid && tokenData.sub) {
      tokenData.uid = tokenData.sub;
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (tokenData.exp < now) {
      console.error('Token has expired');
      return null;
    }

    // Check if it's a Firebase token
    if (!tokenData.iss?.includes('securetoken.google.com')) {
      console.error('Not a valid Firebase token');
      return null;
    }

    return tokenData;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

export function getUserFromDecodedToken(decodedToken: DecodedToken): User {
  // Get the user ID from whichever field is available
  const userId = decodedToken.uid || decodedToken.user_id || decodedToken.sub || '';
  
  return {
    id: userId,
    email: decodedToken.email || '',
    name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
    image: decodedToken.picture || '/default-avatar.svg'
  };
}
