"use client";

import { useEffect } from 'react';
import { initNetworkLogger } from '@/lib/utils/network-logger';

export default function NetworkLoggerInit() {
  useEffect(() => {
    // Only initialize network logger if explicitly enabled in development
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_NETWORK_LOGGER === 'true') {
      initNetworkLogger();
    }
  }, []);

  return null;
}
