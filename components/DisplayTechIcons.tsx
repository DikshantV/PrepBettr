"use client";

import { useMemo } from "react";
import Image from "next/image";

// React Icons imports - only the ones that exist
import { 
  FaReact, FaVuejs, FaAngular, FaHtml5, FaCss3Alt, FaSass, FaBootstrap, 
  FaNodeJs, FaPython, FaJava, FaPhp, FaDocker, FaAws, FaGitAlt, FaGithub, 
  FaGitlab, FaBitbucket, FaWordpress, FaDrupal, FaJoomla, FaApple, FaAndroid
} from "react-icons/fa";

import { 
  SiNextdotjs, SiSvelte, SiTypescript, SiJavascript, SiTailwindcss, SiMui,
  SiExpress, SiDjango, SiFlask, SiSpring, SiRuby, SiRubyonrails, SiGo, SiRust,
  SiDotnet, SiMongodb, SiMysql, SiPostgresql, SiRedis, SiSqlite,
  SiOracle, SiElasticsearch, SiFlutter, SiSwift, SiKotlin, SiKubernetes,
  SiGooglecloud, SiFirebase, SiVercel, SiNetlify, SiWebpack,
  SiVite, SiRollupdotjs, SiBabel, SiEslint, SiPrettier, SiJest, SiCypress,
  SiRedux, SiMobx, SiGraphql, SiApollographql,
  SiPostman, SiJenkins, SiGithubactions, SiCircleci, SiTravisci, SiLaravel,
  SiSymfony, SiCodeigniter, SiShopify, SiStrapi, SiContentful, SiSanity
} from "react-icons/si";

import { cn, getTechIcons } from "@/lib/utils";

// Icon component mapping - maps React Icon names to actual components
const iconComponentMap: Record<string, React.ComponentType<{ className?: string; title?: string }>> = {
  // FontAwesome Icons
  FaReact, FaVuejs, FaAngular, FaHtml5, FaCss3Alt, FaSass, FaBootstrap,
  FaNodeJs, FaPython, FaJava, FaPhp, FaDocker, FaAws, FaGitAlt, FaGithub,
  FaGitlab, FaBitbucket, FaWordpress, FaDrupal, FaJoomla, FaApple, FaAndroid,
  
  // Simple Icons
  SiNextdotjs, SiSvelte, SiTypescript, SiJavascript, SiTailwindcss, SiMui,
  SiExpress, SiDjango, SiFlask, SiSpring, SiRuby, SiRubyonrails, SiGo, SiRust,
  SiDotnet, SiMongodb, SiMysql, SiPostgresql, SiRedis, SiSqlite,
  SiOracle, SiElasticsearch, SiFlutter, SiSwift, SiKotlin, SiKubernetes,
  SiGooglecloud, SiFirebase, SiVercel, SiNetlify, SiWebpack,
  SiVite, SiRollupdotjs, SiBabel, SiEslint, SiPrettier, SiJest, SiCypress,
  SiRedux, SiMobx, SiGraphql, SiApollographql,
  SiPostman, SiJenkins, SiGithubactions, SiCircleci, SiTravisci, SiLaravel,
  SiSymfony, SiCodeigniter, SiShopify, SiStrapi, SiContentful, SiSanity,
};

interface TechIconProps {
  techStack: string[];
  maxIcons?: number;
  iconSize?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

interface TechIconDisplayProps {
  tech: string;
  type: 'react-icon' | 'devicon';
  icon: string;
  fallbackUrl?: string;
  size: string;
  index: number;
  showTooltip: boolean;
}

/**
 * Individual tech icon component with proper accessibility and error handling
 */
const TechIconDisplay = ({ 
  tech, 
  type, 
  icon, 
  fallbackUrl, 
  size, 
  index, 
  showTooltip 
}: TechIconDisplayProps) => {
  // Render React Icon component
  if (type === 'react-icon' && iconComponentMap[icon]) {
    const IconComponent = iconComponentMap[icon];
    
    return (
      <div
        className={cn(
          "relative group bg-gray-800 hover:bg-gray-700 rounded-full p-2 flex items-center justify-center transition-all duration-200 ease-in-out transform hover:scale-110 border border-gray-600 hover:border-blue-500",
          index >= 1 && "-ml-2",
          size
        )}
        role="img"
        aria-label={`${tech} technology icon`}
      >
        {showTooltip && (
          <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 border border-gray-600">
            {tech}
          </span>
        )}
        <IconComponent 
          className="w-full h-full text-white" 
          title={`${tech} logo`}
        />
      </div>
    );
  }
  
  // Fallback to image for DevIcons or when React Icon is not available
  if (fallbackUrl) {
    return (
      <div
        className={cn(
          "relative group bg-gray-800 hover:bg-gray-700 rounded-full p-2 flex items-center justify-center transition-all duration-200 ease-in-out transform hover:scale-110 border border-gray-600 hover:border-blue-500",
          index >= 1 && "-ml-2",
          size
        )}
        role="img"
        aria-label={`${tech} technology icon`}
      >
        {showTooltip && (
          <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 border border-gray-600">
            {tech}
          </span>
        )}
        <Image
          src={fallbackUrl}
          alt={`${tech} logo`}
          width={20}
          height={20}
          className="w-full h-full object-contain filter brightness-0 invert"
          onError={(e) => {
            // Final fallback to default tech icon
            const target = e.target as HTMLImageElement;
            target.src = '/tech.svg';
          }}
        />
      </div>
    );
  }
  
  return null; // Don't render anything if no valid icon configuration
};

/**
 * Professional tech stack icon display component
 * Features:
 * - Uses React Icons for consistent, high-quality icons
 * - Only displays technologies with available icons
 * - Responsive design with hover effects
 * - Accessible with proper ARIA labels and tooltips
 * - Maintains visual consistency with dark theme
 */
const DisplayTechIcons = ({ 
  techStack, 
  maxIcons = 6, 
  iconSize = 'md',
  showTooltip = true 
}: TechIconProps) => {
  // Memoize icon processing to avoid unnecessary recalculations
  const availableIcons = useMemo(() => {
    return getTechIcons(techStack, maxIcons);
  }, [techStack, maxIcons]);

  // Size mapping for consistent styling
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11'
  };

  const sizeClass = sizeClasses[iconSize];

  // Early return if no icons are available
  if (availableIcons.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-gray-500 text-sm"
        role="status"
        aria-label="No technology icons available"
      >
        <span className="sr-only">No displayable technology icons</span>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center"
      role="list"
      aria-label={`Technology stack: ${availableIcons.map(icon => icon?.tech).filter(Boolean).join(', ')}`}
    >
      {availableIcons.map((iconConfig, index) => (
        <div key={`${iconConfig.tech}-${index}`} role="listitem">
          <TechIconDisplay
            tech={iconConfig.tech}
            type={iconConfig.type}
            icon={iconConfig.icon}
            fallbackUrl={iconConfig.fallbackUrl}
            size={sizeClass}
            index={index}
            showTooltip={showTooltip}
          />
        </div>
      ))}
      
      {/* Show remaining count if there are more technologies */}
      {techStack.length > maxIcons && (
        <div 
          className={cn(
            "relative group bg-gray-800 hover:bg-gray-700 rounded-full p-2 flex items-center justify-center transition-all duration-200 ease-in-out border border-gray-600 -ml-2",
            sizeClass
          )}
          role="button"
          aria-label={`${techStack.length - maxIcons} more technologies`}
        >
          {showTooltip && (
            <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 border border-gray-600">
              +{techStack.length - maxIcons} more
            </span>
          )}
          <span className="text-white text-xs font-medium">
            +{techStack.length - maxIcons}
          </span>
        </div>
      )}
    </div>
  );
};

export default DisplayTechIcons;
