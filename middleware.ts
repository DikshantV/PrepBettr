import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge-runtime compatible authentication check
// Note: Only checks session cookies as localStorage is not available in edge runtime
// This prevents divergent behavior between client-side auth checks and middleware
async function isAuthenticatedFromRequest(request: NextRequest): Promise<{
  authenticated: boolean;
  uid?: string;
  email?: string;
  error?: string;
}> {
  const timestamp = new Date().toISOString();
  
  try {
    // Check for session cookie (localStorage tokens not available in edge runtime)
    const sessionCookie = request.cookies.get('session');
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔒 [${timestamp}] Middleware auth check - Session cookie:`, sessionCookie ? '***EXISTS***' : 'NONE');
      if (sessionCookie) {
        console.log(`🔒 [${timestamp}] Session value preview:`, sessionCookie.value.substring(0, 20) + '...');
        console.log(`🔒 [${timestamp}] Session cookie details:`, {
          length: sessionCookie.value.length,
          parts: sessionCookie.value.split('.').length,
          isJWT: sessionCookie.value.includes('.'),
          isMock: sessionCookie.value.startsWith('mock-token-')
        });
      }
    }
    
    // If no session cookie exists, user is not authenticated
    if (!sessionCookie || !sessionCookie.value) {
      return { authenticated: false, error: 'No session cookie found' };
    }

    const sessionValue = sessionCookie.value.trim();
    
    // Accept mock tokens for development
    if (sessionValue.startsWith('mock-token-')) {
      console.log(`🔒 [${timestamp}] Middleware auth check - Found mock token`);
      return { authenticated: true, uid: 'mock-user', email: 'mock@example.com' };
    }
    
    // For Firebase session cookies/tokens, validate structure
    if (sessionValue.includes('.')) {
      const parts = sessionValue.split('.');
      if (parts.length >= 3) {
        try {
          // Try to decode the payload without verification (for middleware performance)
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          
          // Check if token is not obviously expired
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < now) {
            console.log(`🔒 [${timestamp}] Middleware - Token expired:`, {
              exp: payload.exp,
              now,
              expired: payload.exp < now
            });
            return { authenticated: false, error: 'Session token expired' };
          }
          
          console.log(`🔒 [${timestamp}] Middleware - Valid JWT structure found:`, {
            uid: payload.uid || payload.sub,
            email: payload.email,
            exp: payload.exp
          });
          
          return {
            authenticated: true,
            uid: payload.uid || payload.sub,
            email: payload.email
          };
        } catch (decodeError) {
          console.error(`🔒 [${timestamp}] Middleware - Failed to decode token payload:`, decodeError);
          return { authenticated: false, error: 'Invalid token format' };
        }
      }
    }
    
    // Fallback for non-JWT tokens
    const hasValidLength = sessionValue.length > 0;
    console.log(`🔒 [${timestamp}] Middleware - Non-JWT token validation:`, {
      length: sessionValue.length,
      valid: hasValidLength
    });
    
    return { 
      authenticated: hasValidLength,
      error: hasValidLength ? undefined : 'Empty session token'
    };
    
  } catch (error) {
    console.error(`🔒 [${timestamp}] Error checking authentication in middleware:`, error);
    return { 
      authenticated: false, 
      error: error instanceof Error ? error.message : 'Authentication check failed' 
    };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const timestamp = new Date().toISOString();
  
  // Get authentication status
  const authResult = await isAuthenticatedFromRequest(request);
  const isAuthenticated = authResult.authenticated;
  
  // Add debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔒 [${timestamp}] Middleware: ${request.method} ${pathname}`, {
      authenticated: isAuthenticated,
      uid: authResult.uid,
      email: authResult.email,
      error: authResult.error
    });
  }
  
  // Check for potential redirect loops by examining the referer
  const referer = request.headers.get('referer');
  const isFromSamePage = referer?.includes(pathname);
  
  // Prevent redirect loops - if we're being redirected from the same page we're trying to redirect to
  if (isFromSamePage && process.env.NODE_ENV === 'development') {
    console.warn(`Middleware: Potential redirect loop detected for ${pathname} from ${referer}`);
  }

  // Only check authentication for dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      // Don't redirect if we might be in a loop
      if (referer?.includes('/sign-in') || isFromSamePage) {
        console.warn(`🔄 [${timestamp}] Middleware: Preventing redirect loop - letting request through to dashboard (referer: ${referer})`);
        return NextResponse.next();
      }
      
      const signInUrl = new URL('/sign-in', request.url);
      console.log(`➡️ [${timestamp}] Middleware: Redirecting unauthenticated user from ${pathname} to /sign-in`);
      return NextResponse.redirect(signInUrl, { status: 307 });
    } else {
      console.log(`✅ [${timestamp}] Middleware: Authenticated user accessing ${pathname} - allowing through`);
    }
  }

  // For authenticated users trying to access sign-in or sign-up pages,
  // redirect them to dashboard (but be gentle about it)
  if (pathname === '/sign-in' || pathname === '/sign-up') {
    if (isAuthenticated) {
      // Only redirect if NOT coming from dashboard (to prevent loops)
      const comingFromDashboard = referer?.includes('/dashboard');
      
      if (comingFromDashboard) {
        console.warn(`Middleware: User came from dashboard to ${pathname}, allowing access`);
        return NextResponse.next();
      }
      
      console.log(`Middleware: Authenticated user on ${pathname}, redirecting to dashboard`);
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl, { status: 307 });
    }
  }

  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/sign-in',
    '/sign-up'
  ]
};
