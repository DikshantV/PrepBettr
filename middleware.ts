import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge-runtime compatible authentication check
function isAuthenticatedFromRequest(request: NextRequest): boolean {
  try {
    // Check for session cookie
    const sessionCookie = request.cookies.get('session');
    
    // If no session cookie exists, user is not authenticated
    if (!sessionCookie || !sessionCookie.value) {
      return false;
    }

    // Basic validation - in a real scenario you might want to validate the token
    // but for middleware in edge runtime, we just check if it exists and is not empty
    const sessionValue = sessionCookie.value.trim();
    return sessionValue.length > 0;
  } catch (error) {
    console.error('Error checking authentication in middleware:', error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // Only check authentication for dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const isAuthenticated = isAuthenticatedFromRequest(request);
    
    if (!isAuthenticated) {
      // Redirect to sign-in page
      const signInUrl = new URL('/sign-in', request.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  // For authenticated users trying to access sign-in or sign-up pages,
  // redirect them to dashboard
  if (request.nextUrl.pathname === '/sign-in' || request.nextUrl.pathname === '/sign-up') {
    const isAuthenticated = isAuthenticatedFromRequest(request);
    
    if (isAuthenticated) {
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
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
