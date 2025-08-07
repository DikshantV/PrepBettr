'use client';
import { MantineProvider } from '@mantine/core';
import { ReactNode } from 'react';
import { SWRProvider } from '@/contexts/SWRProvider';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRProvider>
      <MantineProvider
        theme={{
          fontFamily: 'inherit',         // stick to existing marketing fonts
          primaryColor: 'blue',
        }}
      >
        {children}
      </MantineProvider>
    </SWRProvider>
  );
}
