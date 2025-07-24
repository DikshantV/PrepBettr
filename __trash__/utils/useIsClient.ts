'use client';

import { useState, useEffect } from 'react';

/**
 * Universal hook to detect if code is running on the client side.
 * This ensures identical markup between SSR and CSR when necessary.
 * 
 * @returns boolean - true if running on client, false if server-side
 * 
 * @example
 * ```tsx
 * const isClient = useIsClient();
 * if (!isClient) return null; // Prevents hydration mismatches
 * 
 * // Safe to use client-only code here
 * return <ClientOnlyComponent />;
 * ```
 */
export function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return isClient;
}
