"use client";

/**
 * Network Call Tracer
 * 
 * Monkey-patches window.fetch to log all network requests with stack traces
 * Only enabled in development environment
 */

interface NetworkCall {
  url: string;
  method: string;
  timestamp: number;
  stack: string;
  caller?: string;
}

const networkCalls: NetworkCall[] = [];
const originalFetch = typeof window !== 'undefined' ? window.fetch : null;

/**
 * Initialize network logging
 */
export function initNetworkLogger() {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined' || !originalFetch) {
    return;
  }

  console.log('🔍 Network logger initialized - tracing all fetch calls');

  // Monkey patch window.fetch
  window.fetch = function(...args) {
    const [input, init] = args;
    const url = typeof input === 'string' ? input : 
               input instanceof URL ? input.toString() : 
               (input as Request).url;
    const method = init?.method || 'GET';
    
    // Create error to capture stack trace
    const error = new Error();
    const stack = error.stack || '';
    
    // Extract caller information from stack trace
    const stackLines = stack.split('\n');
    const caller = stackLines[2]?.trim() || 'unknown';
    
    const networkCall: NetworkCall = {
      url,
      method,
      timestamp: Date.now(),
      stack,
      caller
    };
    
    networkCalls.push(networkCall);
    
    // Log auth-related calls immediately
    if (url.includes('/api/auth/')) {
      console.group(`🔍 AUTH API CALL: ${method} ${url}`);
      console.log('Timestamp:', new Date(networkCall.timestamp).toISOString());
      console.log('Caller:', caller);
      console.log('Full stack:', stack);
      console.groupEnd();
    }
    
    // Log dashboard-related calls immediately
    if (url.includes('/api/dashboard/') || url.includes('/dashboard')) {
      console.group(`📊 DASHBOARD API CALL: ${method} ${url}`);
      console.log('Timestamp:', new Date(networkCall.timestamp).toISOString());
      console.log('Caller:', caller);
      console.log('Full stack:', stack);
      console.groupEnd();
    }
    
    // Log sync-firebase calls (potential polling source)
    if (url.includes('/api/auth/sync-firebase')) {
      console.group(`🔄 SYNC-FIREBASE CALL: ${method} ${url}`);
      console.log('Timestamp:', new Date(networkCall.timestamp).toISOString());
      console.log('Caller:', caller);
      console.warn('⚠️  This may be part of a polling loop!');
      console.log('Full stack:', stack);
      console.groupEnd();
    }
    
    // Call original fetch
    return originalFetch.apply(this, args);
  };
}

/**
 * Get all network calls
 */
export function getNetworkCalls(): NetworkCall[] {
  return [...networkCalls];
}

/**
 * Get auth-related network calls
 */
export function getAuthCalls(): NetworkCall[] {
  return networkCalls.filter(call => call.url.includes('/api/auth/'));
}

/**
 * Get calls to specific endpoint
 */
export function getCallsToEndpoint(endpoint: string): NetworkCall[] {
  return networkCalls.filter(call => call.url.includes(endpoint));
}

/**
 * Analyze call frequency for potential loops
 */
export function analyzeLoops(windowMs: number = 5000): {
  endpoint: string;
  count: number;
  frequency: number;
  isLoop: boolean;
}[] {
  const now = Date.now();
  const recentCalls = networkCalls.filter(call => (now - call.timestamp) <= windowMs);
  
  const endpointCounts = recentCalls.reduce((acc, call) => {
    acc[call.url] = (acc[call.url] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(endpointCounts).map(([endpoint, count]) => ({
    endpoint,
    count,
    frequency: count / (windowMs / 1000), // calls per second
    isLoop: count > 3 // More than 3 calls in window indicates a potential loop
  }));
}

/**
 * Clear network call history
 */
export function clearNetworkHistory(): void {
  networkCalls.length = 0;
  console.log('🗑️ Network call history cleared');
}

/**
 * Display current network statistics
 */
export function displayNetworkStats(): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  const authCalls = getAuthCalls();
  const loops = analyzeLoops();
  
  console.group('📊 Network Statistics');
  console.log(`Total calls: ${networkCalls.length}`);
  console.log(`Auth calls: ${authCalls.length}`);
  
  if (loops.length > 0) {
    console.group('🔄 Potential loops detected:');
    loops.filter(l => l.isLoop).forEach(loop => {
      console.warn(`${loop.endpoint}: ${loop.count} calls (${loop.frequency.toFixed(1)}/s)`);
    });
    console.groupEnd();
  }
  
  if (authCalls.length > 0) {
    console.group('🔐 Recent auth calls:');
    authCalls.slice(-5).forEach(call => {
      console.log(`${call.method} ${call.url} - ${call.caller}`);
    });
    console.groupEnd();
  }
  
  console.groupEnd();
}

/**
 * Export network statistics for testing
 */
export function getNetworkStats() {
  return {
    totalCalls: networkCalls.length,
    authCalls: getAuthCalls().length,
    loops: analyzeLoops(),
    recentAuthCalls: getAuthCalls().slice(-10)
  };
}

// Auto-display stats every 10 seconds in development (DISABLED to prevent polling)
// if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
//   setInterval(displayNetworkStats, 10000);
// }

// Instead, provide manual trigger for debugging:
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).showNetworkStats = displayNetworkStats;
  console.log('🔍 Network logger active. Call showNetworkStats() to display current stats.');
}
