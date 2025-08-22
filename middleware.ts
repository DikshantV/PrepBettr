import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge-runtime compatible authentication check
// Note: Only checks session cookies as localStorage is not available in edge runtime
// This prevents divergent behavior between client-side auth checks and middleware
function isAuthenticatedFromRequest(request: NextRequest): boolean {
  try {
    // Check for session cookie (localStorage tokens not available in edge runtime)
    const sessionCookie = request.cookies.get('session');
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Middleware auth check - Session cookie:', sessionCookie ? '***EXISTS***' : 'NONE');
      if (sessionCookie) {
        console.log('Middleware auth check - Session value preview:', sessionCookie.value.substring(0, 20) + '...');
      }
    }
    
    // If no session cookie exists, user is not authenticated
    if (!sessionCookie || !sessionCookie.value) {
      return false;
    }

    // Basic validation - check if it's a valid token format
    const sessionValue = sessionCookie.value.trim();
    
    // Accept mock tokens for development
    if (sessionValue.startsWith('mock-token-')) {
      console.log('Middleware auth check - Found mock token');
      return true;
    }
    
    // For real Firebase tokens, just check if they exist and have proper structure
    // JWT tokens should have at least 3 parts separated by dots
    if (sessionValue.includes('.')) {
      const parts = sessionValue.split('.');
      const isValid = parts.length >= 3;
      console.log('Middleware auth check - JWT token parts:', parts.length, '- Valid:', isValid);
      return isValid;
    }
    
    const isValid = sessionValue.length > 0;
    console.log('Middleware auth check - Non-JWT token length:', sessionValue.length, '- Valid:', isValid);
    return isValid;
  } catch (error) {
    console.error('Error checking authentication in middleware:', error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = isAuthenticatedFromRequest(request);
  
  // Add debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log(`Middleware: ${request.method} ${pathname} - Auth: ${isAuthenticated}`);
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
        console.warn('Middleware: Preventing redirect loop - letting request through to dashboard');
        return NextResponse.next();
      }
      
      const signInUrl = new URL('/sign-in', request.url);
      console.log('Middleware: Redirecting unauthenticated user to sign-in');
      return NextResponse.redirect(signInUrl, { status: 307 });
    }
  }

  // For authenticated users trying to access sign-in or sign-up pages,
  // redirect them to dashboard - but only if not in a loop
  if (pathname === '/sign-in' || pathname === '/sign-up') {
    if (isAuthenticated) {
      // Completely prevent redirects if we detect a potential loop
      if (referer?.includes('/dashboard') || referer?.includes('/sign-in') || isFromSamePage) {
        console.warn('Middleware: Preventing redirect loop - letting authenticated user stay on auth page');
        return NextResponse.next();
      }
      
      const dashboardUrl = new URL('/dashboard', request.url);
      console.log('Middleware: Redirecting authenticated user to dashboard');
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
