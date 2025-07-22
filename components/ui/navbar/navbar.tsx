'use client';

import {JSX} from 'react';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSimpleScrollDirection } from '@/hooks/useSimpleScrollDirection';
import { useIsClient } from '@/hooks/useIsClient';

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
  const isClient = useIsClient();
  const { visible } = useSimpleScrollDirection();

  return (
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
        'fixed inset-x-0 top-0 z-50 flex justify-center w-full pt-6 pb-4',
        className
      )}
    >
      <div className="flex items-center justify-between w-full max-w-6xl px-6">
        {/* Logo */}
        <div className="flex-shrink-0">
          <Image 
            src="/logo.svg" 
            alt="Interview Prep Logo" 
            width={140} 
            height={35}
            className="h-9 w-auto"
            priority
          />
        </div>
        
        {/* Navigation Items */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <div className="flex items-center space-x-6 rounded-full bg-dark-200/80 px-8 py-3 text-sm font-medium text-light-100 shadow-lg shadow-black/[0.03] backdrop-blur-sm">
            {navItems.map((navItem, idx) => (
              <a
                key={`link=${idx}`}
                href={navItem.link}
                className={cn(
                  'relative flex items-center space-x-2 text-light-100 hover:text-primary-100 transition-colors',
                  isClient && pathname === navItem.link ? 'text-primary-100' : ''
                )}
              >
                <span className="block sm:hidden">{navItem.icon}</span>
                <span className="hidden text-sm font-medium sm:block">{navItem.name}</span>
                {isClient && pathname === navItem.link && (
                  <span className="absolute -bottom-2 left-0 h-0.5 w-full bg-primary-100" />
                )}
              </a>
            ))}
          </div>
        </div>

        {/* Login Button */}
        <div className="flex-shrink-0">
          <a
            href="/login"
            className="flex items-center space-x-2 text-light-100 hover:text-primary-100 transition-colors"
          >
            <span className="hidden sm:block text-sm font-medium">Login</span>
            <LogIn className="h-5 w-5" />
          </a>
        </div>
      </div>
    </motion.div>
  );
};
