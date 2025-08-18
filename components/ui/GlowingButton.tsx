"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface GlowingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  glowClassName?: string;
  innerClassName?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const GlowingButton = React.forwardRef<HTMLButtonElement, GlowingButtonProps>(
  ({ children, className, glowClassName, innerClassName, disabled, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-12 px-4 text-base',
      lg: 'h-14 px-8 text-lg'
    };

    return (
      <button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        disabled={disabled}
        {...props}
      >
        {/* Animated gradient border */}
        <span 
          className={cn(
            "absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]",
            disabled && "animate-none opacity-50",
            glowClassName
          )} 
        />
        
        {/* Inner button content */}
        <span 
          className={cn(
            "inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 font-medium text-white backdrop-blur-3xl dark:bg-slate-900",
            sizeClasses[size],
            disabled && "cursor-not-allowed",
            innerClassName
          )}
        >
          {children}
        </span>
      </button>
    );
  }
);

GlowingButton.displayName = 'GlowingButton';

export { GlowingButton };
