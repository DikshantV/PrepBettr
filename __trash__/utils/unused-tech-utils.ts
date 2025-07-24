// Unused utility functions moved from lib/utils.ts

/**
 * Check if a technology has an available icon
 * @param tech - Technology name to check
 * @returns boolean indicating if icon is available
 */
export const hasTechIcon = (tech: string): boolean => {
  const normalized = normalizeTechName(tech);
  return !!techIconsMap[normalized];
};

/**
 * Get filtered array of technologies that have available icons
 * @param techArray - Array of technology names
 * @returns Array of technology names that have available icons
 */
export const getAvailableTechnologies = (techArray: string[] = []): string[] => {
  return techArray.filter(hasTechIcon);
};

// Legacy function for backward compatibility - will be deprecated
export const getTechLogos = async (techArray: string[] = []) => {
  if (!techArray || techArray.length === 0) return [];
  
  return techArray.slice(0, 5).map(tech => {
    const normalized = normalizeTechName(tech);
    const iconConfig = techIconsMap[normalized];
    
    // For backward compatibility, return URL format
    if (iconConfig?.type === 'react-icon') {
      return { tech, url: iconConfig.icon }; // React Icon component name
    } else if (iconConfig?.fallbackUrl) {
      return { tech, url: iconConfig.fallbackUrl };
    }
    
    return { tech, url: '/tech.svg' };
  });
};

// Helper function that would be needed for the above functions
const normalizeTechName = (tech: string) => {
  if (!tech) return '';
  // First normalize common tech names
  const normalized = tech.toLowerCase()
    .replace(/\.js$/, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
  
  // Special handling for common tech names
  if (['node', 'nodejs'].includes(normalized)) return 'nodejs';
  if (['next', 'nextjs'].includes(normalized)) return 'nextjs';
  
  return normalized;
};

// This would need to be imported or defined, but since it's referenced by the unused functions
const techIconsMap: Record<string, any> = {};
