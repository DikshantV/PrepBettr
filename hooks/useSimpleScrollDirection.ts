import { useState, useEffect } from 'react';

export function useSimpleScrollDirection() {
  const [visible, setVisible] = useState(true); // Initialize as visible for SSR
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    // Initialize visibility as true after first effect run
    setVisible(true);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return { visible };
}
