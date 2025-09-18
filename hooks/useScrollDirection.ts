import { useState, useEffect } from 'react';

interface ScrollState {
  visible: boolean;
  isScrolled: boolean;
  isScrollingUp: boolean;
  lastScrollY: number;
}

export function useScrollDirection() {
  const [scrollState, setScrollState] = useState<ScrollState>({
    visible: true, // Initialize as visible for SSR
    isScrolled: false,
    isScrollingUp: false,
    lastScrollY: 0,
  });

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      setScrollState(prev => {
        // Check if we've scrolled past 10px
        const isScrolled = currentScrollY > 10;
        
        // Check scroll direction
        const isScrollingUp = currentScrollY < prev.lastScrollY;
        
        // Show/hide based on scroll direction and position
        let visible = prev.visible;
        if (currentScrollY > prev.lastScrollY && currentScrollY > 100) {
          // Scrolling down and past 100px
          visible = false;
        } else if (currentScrollY < prev.lastScrollY || currentScrollY < 10) {
          // Scrolling up or at top
          visible = true;
        }

        return {
          visible,
          isScrolled,
          isScrollingUp,
          lastScrollY: currentScrollY,
        };
      });
    };

    // Initialize visibility as true after first effect run
    setScrollState(prev => ({ ...prev, visible: true }));

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return scrollState;
}
