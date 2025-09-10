'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { useIsClient } from '@/hooks/useIsClient';
import { useAuth } from '@/contexts/AuthContext';
import type { JSX } from 'react';

export const FloatingNav = ({
  navItems,
  className,
  onDashboardClick,
}: {
  navItems: {
    name: string;
    link: string;
    icon?: JSX.Element;
    onClick?: () => void;
  }[];
  className?: string;
  onDashboardClick?: () => void;
}) => {
  const pathname = usePathname();
  const isClient = useIsClient();
  const { visible, isScrolled, isScrollingUp } = useScrollDirection();
  const { user, loading } = useAuth();
  
  // During server render and initial client render, show placeholder
  if (loading) {
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
                    isClient && pathname === navItem.link ? 'text-black dark:text-white font-semibold' : ''
                  )}
                >
                  {navItem.name}
                </a>
              ))}
            </div>

            {/* Placeholder for auth button */}
            <div className="ml-auto">
              <div className="relative inline-flex h-10 items-center justify-center overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50">
                <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-6 py-2 text-sm font-medium text-white backdrop-blur-3xl">
                  {/* Placeholder that matches both states */}
                  Loading...
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

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
            {navItems.map((navItem, idx) => {
              if (navItem.onClick) {
                return (
                  <button
                    key={`btn-${idx}`}
                    onClick={navItem.onClick}
                    className={cn(
                      'text-sm font-medium text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white transition-colors',
                      isClient && pathname === navItem.link ? 'text-black dark:text-white font-semibold' : ''
                    )}
                  >
                    {navItem.name}
                  </button>
                );
              }
              return (
                <a
                  key={`link-${idx}`}
                  href={navItem.link}
                  className={cn(
                    'text-sm font-medium text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white transition-colors',
                    isClient && pathname === navItem.link ? 'text-black dark:text-white font-semibold' : ''
                  )}
                >
                  {navItem.name}
                </a>
              );
            })}
          </div>

          {/* Dashboard/Sign In Button - Right Aligned */}
          <div className="ml-auto">
            {user && onDashboardClick ? (
              <button
                onClick={onDashboardClick}
                className="relative inline-flex h-10 items-center justify-center overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
              >
                <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-6 py-2 text-sm font-medium text-white backdrop-blur-3xl">
                  Dashboard
                </span>
              </button>
            ) : (
              <Link
                href={user ? "/dashboard" : "/sign-in"}
                className="relative inline-flex h-10 items-center justify-center overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
                data-testid={user ? "dashboard-btn" : "login-btn"}
              >
                <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-6 py-2 text-sm font-medium text-white backdrop-blur-3xl">
                  {user ? 'Dashboard' : 'Sign In'}
                </span>
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
