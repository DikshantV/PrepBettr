/**
 * Mock Authentication Service
 * 
 * Provides a fallback authentication system when Firebase is not properly configured
 * This allows development to continue without proper Firebase credentials
 */

// Mock user data
const MOCK_USERS = [
  {
    uid: 'mock-user-1',
    email: 'demo@prepbettr.com',
    displayName: 'Demo User',
    emailVerified: true,
    photoURL: 'https://via.placeholder.com/150/2563eb/ffffff?text=DU'
  },
  {
    uid: 'mock-user-2', 
    email: 'test@prepbettr.com',
    displayName: 'Test User',
    emailVerified: true,
    photoURL: 'https://via.placeholder.com/150/059669/ffffff?text=TU'
  }
];

// Current mock user session
let currentMockUser = null;
let mockAuthListeners = [];

/**
 * Mock Firebase Auth Methods
 */
export const mockAuth = {
  currentUser: null,
  
  // Mock sign in with popup (Google)
  signInWithPopup: async (auth, provider) => {
    console.log('🔒 Mock: Simulating Google sign-in...');
    
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Select a random mock user
    const mockUser = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];
    currentMockUser = mockUser;
    mockAuth.currentUser = mockUser;
    
    console.log('🔒 Mock: Sign-in successful', mockUser);
    
    // Notify listeners
    mockAuthListeners.forEach(listener => listener(mockUser));
    
    return {
      user: mockUser,
      credential: {
        accessToken: 'mock-access-token',
        idToken: generateMockJWT(mockUser)
      }
    };
  },
  
  // Mock sign out
  signOut: async () => {
    console.log('🔒 Mock: Signing out...');
    currentMockUser = null;
    mockAuth.currentUser = null;
    
    // Notify listeners
    mockAuthListeners.forEach(listener => listener(null));
  },
  
  // Mock auth state listener
  onAuthStateChanged: (callback) => {
    console.log('🔒 Mock: Auth state listener registered');
    mockAuthListeners.push(callback);
    
    // Immediately call with current user
    callback(currentMockUser);
    
    // Return unsubscribe function
    return () => {
      mockAuthListeners = mockAuthListeners.filter(listener => listener !== callback);
    };
  },
  
  // Mock get ID token
  getIdToken: async (user, forceRefresh = false) => {
    console.log('🔒 Mock: Getting ID token', { forceRefresh });
    return generateMockJWT(user || currentMockUser);
  }
};

/**
 * Mock Google Auth Provider
 */
export const mockGoogleProvider = {
  setCustomParameters: (params) => {
    console.log('🔒 Mock: Google provider custom parameters set', params);
  },
  addScope: (scope) => {
    console.log('🔒 Mock: Google provider scope added', scope);
  }
};

/**
 * Generate a mock JWT token for testing
 */
function generateMockJWT(user) {
  if (!user) {
    throw new Error('No user provided for JWT generation');
  }
  
  const header = {
    alg: 'RS256',
    kid: 'mock-key-id',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://securetoken.google.com/prepbettr',
    aud: 'prepbettr',
    auth_time: now - 60,
    user_id: user.uid,
    uid: user.uid,
    sub: user.uid,
    iat: now,
    exp: now + (60 * 60), // 1 hour
    email: user.email,
    email_verified: user.emailVerified,
    name: user.displayName,
    picture: user.photoURL,
    firebase: {
      identities: {
        'google.com': [user.uid],
        email: [user.email]
      },
      sign_in_provider: 'google.com'
    }
  };
  
  // Create a mock JWT (base64url encoded header.payload.signature)
  const encodedHeader = btoa(JSON.stringify(header)).replace(/[+\/=]/g, (m) => ({ '+': '-', '/': '_', '=': '' })[m]);
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/[+\/=]/g, (m) => ({ '+': '-', '/': '_', '=': '' })[m]);
  const mockSignature = 'mock-signature-' + Math.random().toString(36).substring(2, 15);
  
  const jwt = `${encodedHeader}.${encodedPayload}.${mockSignature}`;
  console.log('🔒 Mock: Generated JWT token', { 
    user: user.email, 
    expires: new Date(payload.exp * 1000).toISOString(),
    tokenPreview: jwt.substring(0, 50) + '...'
  });
  
  return jwt;
}

/**
 * Check if we should use mock authentication
 */
export function shouldUseMockAuth() {
  const hasRealFirebaseConfig = !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY
  );
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  const forceMock = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';
  
  return !hasRealFirebaseConfig || forceMock || isDevelopment;
}

/**
 * Get mock authentication services
 */
export function getMockFirebaseServices() {
  console.log('🔒 Mock: Using mock Firebase authentication services');
  
  return {
    auth: () => mockAuth,
    googleProvider: () => mockGoogleProvider,
    isFirebaseReady: () => true,
    initializeFirebaseAsync: async () => {
      console.log('🔒 Mock: Firebase async initialization completed');
      return Promise.resolve();
    }
  };
}

/**
 * Session management for mock auth
 */
export const mockAuthSession = {
  // Set mock session cookie
  setSession: async (user) => {
    const token = generateMockJWT(user);
    
    // Set session cookie via API
    try {
      await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: token,
          mock: true
        })
      });
      
      console.log('🔒 Mock: Session set successfully');
    } catch (error) {
      console.error('🔒 Mock: Failed to set session', error);
    }
  },
  
  // Clear mock session cookie
  clearSession: async () => {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST'
      });
      
      console.log('🔒 Mock: Session cleared successfully');
    } catch (error) {
      console.error('🔒 Mock: Failed to clear session', error);
    }
  }
};

export default {
  mockAuth,
  mockGoogleProvider,
  shouldUseMockAuth,
  getMockFirebaseServices,
  mockAuthSession
};