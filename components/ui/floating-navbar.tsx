'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { JSX } from 'react';

export const FloatingNav = ({
  navItems,
  className,
}: {
  navItems: {
    name: string;
    link: string;
    icon?: JSX.Element;
  }[];
  className?: string;
}) => {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Check if we've scrolled past 10px
      setIsScrolled(currentScrollY > 10);
      
      // Check scroll direction
      setIsScrollingUp(currentScrollY < lastScrollY);
      
      // Show/hide based on scroll direction and position
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down and past 100px
        setVisible(false);
      } else if (currentScrollY < lastScrollY || currentScrollY < 10) {
        // Scrolling up or at top
        setVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{
          opacity: 1,
          y: -100,
        }}
        animate={{
          y: visible ? 0 : -100,
          opacity: visible ? 1 : 0,
        }}
        transition={{
          duration: 0.2,
        }}
        className={cn(
          'fixed left-1/2 top-6 z-50 w-full max-w-6xl -translate-x-1/2 transform px-4',
          className
        )}
      >
        <div 
          className={cn(
            'mx-auto flex w-full items-center justify-between rounded-full px-6 py-3 transition-all duration-300',
            isScrolled && isScrollingUp 
              ? 'bg-white/90 dark:bg-black/90 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg' 
              : 'bg-transparent border border-transparent'
          )}
        >
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Image
              src="/logo.svg"
              alt="Logo"
              width={32}
              height={32}
              className="h-8 w-auto"
            />
            <span className="text-xl font-bold text-black dark:text-white">
              PrepBettr
            </span>
          </div>

          {/* Navigation Items - Centered */}
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 transform md:flex items-center space-x-8">
            {navItems.map((navItem, idx) => (
              <a
                key={`link-${idx}`}
                href={navItem.link}
                className={cn(
                  'text-sm font-medium text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white transition-colors',
                  pathname === navItem.link ? 'text-black dark:text-white font-semibold' : ''
                )}
              >
                {navItem.name}
              </a>
            ))}
          </div>

          {/* Login Button - Right Aligned */}
          <div className="ml-auto">
            <Link
              href="/sign-in"
              className="relative inline-flex h-10 items-center justify-center overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
            >
              <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
              <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-6 py-2 text-sm font-medium text-white backdrop-blur-3xl">
                Dashboard
              </span>
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
