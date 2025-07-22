import dynamic from 'next/dynamic';

export const FloatingNav = dynamic(() => import('./navbar').then(mod => ({ default: mod.FloatingNav })), {
  ssr: false
});
