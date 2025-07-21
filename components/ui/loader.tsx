/**
 * Blue Dragon 70 Loader Component
 * 
 * Integrated from UIverse.io (Nawsome/blue-dragon-70)
 * A sophisticated animated loader with dragon-like aesthetics
 * 
 * Features:
 * - Responsive design with Tailwind CSS
 * - Dark/Light theme support
 * - Accessibility attributes (ARIA labels, screen reader support)
 * - Customizable size and positioning
 * - Smooth animations with CSS transforms
 * - MIT Licensed from UIverse.io
 * 
 * @author Original: Nawsome (UIverse.io)
 * @modified Adapted for PrepBettr React/TypeScript/Tailwind architecture
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface LoaderProps {
  /** Size variant for the loader */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Custom CSS classes */
  className?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
  /** Text to display below the loader */
  text?: string;
  /** Theme variant */
  variant?: 'primary' | 'secondary' | 'accent';
}

/**
 * Blue Dragon 70 Loader Component
 * 
 * Usage:
 * ```tsx
 * <Loader />                           // Default medium size
 * <Loader size="lg" text="Loading..." /> // Large with custom text
 * <Loader variant="accent" />          // Custom theme variant
 * ```
 */
export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  className,
  ariaLabel = 'Loading...',
  text,
  variant = 'primary'
}) => {
  // Size configuration
  const sizeConfig = {
    sm: {
      container: 'w-8 h-8',
      orb: 'w-2 h-2',
      textSize: 'text-xs'
    },
    md: {
      container: 'w-12 h-12',
      orb: 'w-3 h-3',
      textSize: 'text-sm'
    },
    lg: {
      container: 'w-16 h-16',
      orb: 'w-4 h-4',
      textSize: 'text-base'
    },
    xl: {
      container: 'w-24 h-24',
      orb: 'w-6 h-6',
      textSize: 'text-lg'
    }
  };

  // Theme configuration with dragon-inspired colors
  const themeConfig = {
    primary: {
      gradient: 'from-blue-500 via-blue-600 to-indigo-700',
      orbs: 'bg-blue-400',
      glow: 'shadow-blue-500/50',
      text: 'text-blue-600 dark:text-blue-400'
    },
    secondary: {
      gradient: 'from-purple-500 via-purple-600 to-violet-700',
      orbs: 'bg-purple-400',
      glow: 'shadow-purple-500/50',
      text: 'text-purple-600 dark:text-purple-400'
    },
    accent: {
      gradient: 'from-emerald-500 via-teal-600 to-cyan-700',
      orbs: 'bg-emerald-400',
      glow: 'shadow-emerald-500/50',
      text: 'text-emerald-600 dark:text-emerald-400'
    }
  };

  const config = sizeConfig[size];
  const theme = themeConfig[variant];

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className
      )}
      role="status"
      aria-label={ariaLabel}
    >
      {/* Main Dragon Loader */}
      <div className={cn("relative", config.container)}>
        {/* Central Dragon Core */}
        <div 
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-br",
            theme.gradient,
            "animate-pulse",
            "shadow-lg",
            theme.glow
          )}
          style={{
            animation: 'dragonPulse 2s ease-in-out infinite'
          }}
        />
        
        {/* Orbiting Elements (Dragon Scales) */}
        {[...Array(6)].map((_, index) => (
          <div
            key={index}
            className={cn(
              "absolute rounded-full",
              config.orb,
              theme.orbs,
              "shadow-md"
            )}
            style={{
              animation: `dragonOrbit${index + 1} 3s linear infinite`,
              animationDelay: `${index * 0.5}s`
            }}
          />
        ))}
        
        {/* Inner Glow Effect */}
        <div 
          className={cn(
            "absolute inset-2 rounded-full",
            "bg-gradient-to-br from-white/20 to-transparent",
            "animate-spin"
          )}
          style={{
            animation: 'dragonGlow 4s linear infinite reverse'
          }}
        />
      </div>

      {/* Loading Text */}
      {text && (
        <p 
          className={cn(
            "font-medium animate-pulse",
            config.textSize,
            theme.text
          )}
          aria-live="polite"
        >
          {text}
        </p>
      )}

      {/* Custom CSS injected via Tailwind and inline styles */}
    </div>
  );
};

/**
 * Overlay Loader Component
 * 
 * Use this for full-page or section loading states
 * 
 * Usage:
 * ```tsx
 * <LoaderOverlay />
 * <LoaderOverlay text="Processing your request..." />
 * ```
 */
export const LoaderOverlay: React.FC<Omit<LoaderProps, 'className'> & {
  /** Background opacity (0-100) */
  backgroundOpacity?: number;
  /** Whether to show backdrop blur */
  blur?: boolean;
}> = ({ 
  backgroundOpacity = 80, 
  blur = true,
  ...loaderProps 
}) => {
  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        blur && "backdrop-blur-sm",
        "transition-all duration-200"
      )}
      style={{
        backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity / 100})`
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Loading"
    >
      <div className="bg-white/90 dark:bg-gray-900/90 rounded-lg p-6 shadow-xl">
        <Loader {...loaderProps} size={loaderProps.size || 'lg'} />
      </div>
    </div>
  );
};

/**
 * Inline Loader Component
 * 
 * Use this for button loading states or inline contexts
 * 
 * Usage:
 * ```tsx
 * <LoaderInline size="sm" />
 * ```
 */
export const LoaderInline: React.FC<Omit<LoaderProps, 'text'>> = (props) => {
  return (
    <Loader 
      {...props} 
      className={cn("inline-flex", props.className)}
      size={props.size || 'sm'}
    />
  );
};

// Export as default for easier importing
export default Loader;
