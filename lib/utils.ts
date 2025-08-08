import { companyLogos } from "@/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes techstack data to always return a string array
 * Handles cases where techstack might be null, undefined, string, or already an array
 */
export function normalizeTechstack(techstack: string | string[] | null | undefined): string[] {
  if (!techstack) return [];
  
  if (typeof techstack === 'string') {
    return techstack.split(',').map(tech => tech.trim()).filter(Boolean);
  }
  
  if (Array.isArray(techstack)) {
    return techstack.filter(tech => typeof tech === 'string' && tech.trim());
  }
  
  return [];
}

// Tech icon configuration using React Icons (primary) and DevIcons (fallback)
const techIconsMap: Record<string, { type: 'react-icon' | 'devicon'; icon: string; fallbackUrl?: string }> = {
  // Frontend
  'react': { type: 'react-icon', icon: 'FaReact' },
  'nextjs': { type: 'react-icon', icon: 'SiNextdotjs' },
  'next': { type: 'react-icon', icon: 'SiNextdotjs' },
  'next.js': { type: 'react-icon', icon: 'SiNextdotjs' },
  'vue': { type: 'react-icon', icon: 'FaVuejs' },
  'angular': { type: 'react-icon', icon: 'FaAngular' },
  'svelte': { type: 'react-icon', icon: 'SiSvelte' },
  'typescript': { type: 'react-icon', icon: 'SiTypescript' },
  'javascript': { type: 'react-icon', icon: 'SiJavascript' },
  'html': { type: 'react-icon', icon: 'FaHtml5' },
  'css': { type: 'react-icon', icon: 'FaCss3Alt' },
  'sass': { type: 'react-icon', icon: 'FaSass' },
  'tailwind': { type: 'react-icon', icon: 'SiTailwindcss' },
  'tailwindcss': { type: 'react-icon', icon: 'SiTailwindcss' },
  'bootstrap': { type: 'react-icon', icon: 'FaBootstrap' },
  'materialui': { type: 'react-icon', icon: 'SiMui' },
  'mui': { type: 'react-icon', icon: 'SiMui' },
  
  // Backend
  'nodejs': { type: 'react-icon', icon: 'FaNodeJs' },
  'node': { type: 'react-icon', icon: 'FaNodeJs' },
  'node.js': { type: 'react-icon', icon: 'FaNodeJs' },
  'express': { type: 'react-icon', icon: 'SiExpress' },
  'python': { type: 'react-icon', icon: 'FaPython' },
  'django': { type: 'react-icon', icon: 'SiDjango' },
  'flask': { type: 'react-icon', icon: 'SiFlask' },
  'java': { type: 'react-icon', icon: 'FaJava' },
  'spring': { type: 'react-icon', icon: 'SiSpring' },
  'php': { type: 'react-icon', icon: 'FaPhp' },
  'ruby': { type: 'react-icon', icon: 'SiRuby' },
  'rails': { type: 'react-icon', icon: 'SiRubyonrails' },
  'go': { type: 'react-icon', icon: 'SiGo' },
  'golang': { type: 'react-icon', icon: 'SiGo' },
  'rust': { type: 'react-icon', icon: 'SiRust' },
  'csharp': { type: 'devicon', icon: '', fallbackUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg' },
  'c#': { type: 'devicon', icon: '', fallbackUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg' },
  'dotnet': { type: 'react-icon', icon: 'SiDotnet' },
  '.net': { type: 'react-icon', icon: 'SiDotnet' },
  
  // Databases
  'mongodb': { type: 'react-icon', icon: 'SiMongodb' },
  'mysql': { type: 'react-icon', icon: 'SiMysql' },
  'postgresql': { type: 'react-icon', icon: 'SiPostgresql' },
  'postgres': { type: 'react-icon', icon: 'SiPostgresql' },
  'redis': { type: 'react-icon', icon: 'SiRedis' },
  'sqlite': { type: 'react-icon', icon: 'SiSqlite' },
  'oracle': { type: 'react-icon', icon: 'SiOracle' },
  'elasticsearch': { type: 'react-icon', icon: 'SiElasticsearch' },
  
  // Mobile
  'reactnative': { type: 'react-icon', icon: 'FaReact' },
  'flutter': { type: 'react-icon', icon: 'SiFlutter' },
  'swift': { type: 'react-icon', icon: 'SiSwift' },
  'kotlin': { type: 'react-icon', icon: 'SiKotlin' },
  'android': { type: 'react-icon', icon: 'FaAndroid' },
  'ios': { type: 'react-icon', icon: 'FaApple' },
  
  // Cloud & DevOps
  'docker': { type: 'react-icon', icon: 'FaDocker' },
  'kubernetes': { type: 'react-icon', icon: 'SiKubernetes' },
  'aws': { type: 'react-icon', icon: 'FaAws' },
  'azure': { type: 'devicon', icon: '', fallbackUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/azure/azure-original.svg' },
  'gcp': { type: 'react-icon', icon: 'SiGooglecloud' },
  'googlecloud': { type: 'react-icon', icon: 'SiGooglecloud' },
  'firebase': { type: 'react-icon', icon: 'SiFirebase' },
  'vercel': { type: 'react-icon', icon: 'SiVercel' },
  'netlify': { type: 'react-icon', icon: 'SiNetlify' },
  
  // Version Control
  'git': { type: 'react-icon', icon: 'FaGitAlt' },
  'github': { type: 'react-icon', icon: 'FaGithub' },
  'gitlab': { type: 'react-icon', icon: 'FaGitlab' },
  'bitbucket': { type: 'react-icon', icon: 'FaBitbucket' },
  
  // Build Tools & Bundlers
  'webpack': { type: 'react-icon', icon: 'SiWebpack' },
  'vite': { type: 'react-icon', icon: 'SiVite' },
  'rollup': { type: 'react-icon', icon: 'SiRollupdotjs' },
  'babel': { type: 'react-icon', icon: 'SiBabel' },
  'eslint': { type: 'react-icon', icon: 'SiEslint' },
  'prettier': { type: 'react-icon', icon: 'SiPrettier' },
  
  // Testing
  'jest': { type: 'react-icon', icon: 'SiJest' },
  'cypress': { type: 'react-icon', icon: 'SiCypress' },
  'mocha': { type: 'devicon', icon: '', fallbackUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mocha/mocha-plain.svg' },
  
  // State Management
  'redux': { type: 'react-icon', icon: 'SiRedux' },
  'mobx': { type: 'react-icon', icon: 'SiMobx' },
  
  // API Technologies
  'graphql': { type: 'react-icon', icon: 'SiGraphql' },
  'apollo': { type: 'react-icon', icon: 'SiApollographql' },
  'restapi': { type: 'react-icon', icon: 'SiPostman' },
  'rest': { type: 'react-icon', icon: 'SiPostman' },
  
  // CI/CD
  'jenkins': { type: 'react-icon', icon: 'SiJenkins' },
  'githubactions': { type: 'react-icon', icon: 'SiGithubactions' },
  'circleci': { type: 'react-icon', icon: 'SiCircleci' },
  'travis': { type: 'react-icon', icon: 'SiTravisci' },
  
  // Additional Popular Technologies
  'laravel': { type: 'react-icon', icon: 'SiLaravel' },
  'symfony': { type: 'react-icon', icon: 'SiSymfony' },
  'codeigniter': { type: 'react-icon', icon: 'SiCodeigniter' },
  'wordpress': { type: 'react-icon', icon: 'FaWordpress' },
  'drupal': { type: 'react-icon', icon: 'FaDrupal' },
  'joomla': { type: 'react-icon', icon: 'FaJoomla' },
  'shopify': { type: 'react-icon', icon: 'SiShopify' },
  'strapi': { type: 'react-icon', icon: 'SiStrapi' },
  'contentful': { type: 'react-icon', icon: 'SiContentful' },
  'sanity': { type: 'react-icon', icon: 'SiSanity' },
  
  // Additional Frameworks & Libraries (20+ new entries)
  'nuxt': { type: 'react-icon', icon: 'SiNuxtdotjs' },
  'nuxtjs': { type: 'react-icon', icon: 'SiNuxtdotjs' },
  'gatsby': { type: 'react-icon', icon: 'SiGatsby' },
  'ember': { type: 'react-icon', icon: 'SiEmber' },
  'backbone': { type: 'react-icon', icon: 'SiBackbonedotjs' },
  'polymer': { type: 'react-icon', icon: 'SiPolymer' },
  'astro': { type: 'react-icon', icon: 'SiAstro' },
  
  // Backend Frameworks
  'fastapi': { type: 'react-icon', icon: 'SiFastapi' },
  'nestjs': { type: 'react-icon', icon: 'SiNestjs' },
  'koa': { type: 'react-icon', icon: 'SiKoa' },
  'hapi': { type: 'react-icon', icon: 'SiHapi' },
  'deno': { type: 'react-icon', icon: 'SiDeno' },
  
  // Cloud & Database
  'supabase': { type: 'react-icon', icon: 'SiSupabase' },
  'prisma': { type: 'react-icon', icon: 'SiPrisma' },
  'sequelize': { type: 'react-icon', icon: 'SiSequelize' },
  'mariadb': { type: 'react-icon', icon: 'SiMariadb' },
  'cassandra': { type: 'react-icon', icon: 'SiCassandra' },
  'couchdb': { type: 'react-icon', icon: 'SiCouchdb' },
  'neo4j': { type: 'react-icon', icon: 'SiNeo4j' },
  'influxdb': { type: 'react-icon', icon: 'SiInfluxdb' },
  
  // DevOps & Monitoring
  'grafana': { type: 'react-icon', icon: 'SiGrafana' },
  'prometheus': { type: 'react-icon', icon: 'SiPrometheus' },
  'terraform': { type: 'react-icon', icon: 'SiTerraform' },
  'ansible': { type: 'react-icon', icon: 'SiAnsible' },
  'puppet': { type: 'react-icon', icon: 'SiPuppet' },
  'helm': { type: 'react-icon', icon: 'SiHelm' },
  'argo': { type: 'react-icon', icon: 'SiArgo' },
  'rancher': { type: 'react-icon', icon: 'SiRancher' },
  'datadog': { type: 'react-icon', icon: 'SiDatadog' },
  'newrelic': { type: 'react-icon', icon: 'SiNewrelic' },
  'sentry': { type: 'react-icon', icon: 'SiSentry' },
  
  // Data Processing & Analytics
  'elastic': { type: 'react-icon', icon: 'SiElastic' },
  'logstash': { type: 'react-icon', icon: 'SiLogstash' },
  'kibana': { type: 'react-icon', icon: 'SiKibana' },
  'kafka': { type: 'react-icon', icon: 'SiApachekafka' },
  'rabbitmq': { type: 'react-icon', icon: 'SiRabbitmq' },
  'spark': { type: 'react-icon', icon: 'SiApachespark' },
  'hadoop': { type: 'react-icon', icon: 'SiHadoop' },
  'databricks': { type: 'react-icon', icon: 'SiDatabricks' },
  'snowflake': { type: 'react-icon', icon: 'SiSnowflake' },
  'tableau': { type: 'react-icon', icon: 'SiTableau' },
  'powerbi': { type: 'react-icon', icon: 'SiPowerbi' },
  'qlik': { type: 'react-icon', icon: 'SiQlik' },
  
  // Data Visualization
  'd3': { type: 'react-icon', icon: 'SiD3Dotjs' },
  'd3js': { type: 'react-icon', icon: 'SiD3Dotjs' },
  'chartjs': { type: 'react-icon', icon: 'SiChartdotjs' },
  'plotly': { type: 'react-icon', icon: 'SiPlotly' },
  'leaflet': { type: 'react-icon', icon: 'SiLeaflet' },
  'mapbox': { type: 'react-icon', icon: 'SiMapbox' },
  'threejs': { type: 'react-icon', icon: 'SiThreejs' },
  
  // Testing Frameworks
  'playwright': { type: 'react-icon', icon: 'SiPlaywright' },
  'selenium': { type: 'react-icon', icon: 'SiSelenium' },
  'testinglibrary': { type: 'react-icon', icon: 'SiTestinglibrary' },
  'vitest': { type: 'react-icon', icon: 'SiVitest' },
  'storybook': { type: 'react-icon', icon: 'SiStorybook' },
  'chromatic': { type: 'react-icon', icon: 'SiChromatic' },
  
  // Validation & Design
  'zod': { type: 'react-icon', icon: 'SiZod' },
  'yup': { type: 'react-icon', icon: 'SiYup' },
  'figma': { type: 'react-icon', icon: 'SiFigma' },
  'sketch': { type: 'react-icon', icon: 'SiSketch' },
  'adobexd': { type: 'react-icon', icon: 'SiAdobexd' },
  'framer': { type: 'react-icon', icon: 'SiFramer' },
  
  // Web3 & Blockchain
  'solidity': { type: 'react-icon', icon: 'SiSolidity' },
  'ethereum': { type: 'react-icon', icon: 'SiEthereum' },
  'web3': { type: 'react-icon', icon: 'SiWeb3Dotjs' },
  'web3js': { type: 'react-icon', icon: 'SiWeb3Dotjs' },
  'ipfs': { type: 'react-icon', icon: 'SiIpfs' },
  'chainlink': { type: 'react-icon', icon: 'SiChainlink' },
  'alchemy': { type: 'react-icon', icon: 'SiAlchemy' },
  
  // Payment Processing
  'stripe': { type: 'react-icon', icon: 'SiStripe' },
};

// DevIcon fallback URLs for technologies not available in React Icons
const devIconFallbacks: Record<string, string> = {
  'rails': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rails/rails-original-wordmark.svg',
  'mocha': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mocha/mocha-plain.svg',
  'materialui': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/materialui/materialui-original.svg',
  'oracle': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/oracle/oracle-original.svg',
};

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

/**
 * Get available tech icons configuration for a given array of technologies
 * Only returns technologies that have corresponding icons available
 * @param techArray - Array of technology names
 * @param maxIcons - Maximum number of icons to return (default: 6)
 * @returns Array of tech icon configurations
 */
export const getTechIcons = (techArray: string[] = [], maxIcons: number = 6) => {
  if (!techArray || techArray.length === 0) return [];
  
  // Filter and map technologies to their icon configurations
  const availableIcons = techArray
    .map(tech => {
      const normalized = normalizeTechName(tech);
      const iconConfig = techIconsMap[normalized];
      
      // Only include technologies that have icon configurations
      if (iconConfig) {
        return {
          tech: tech.trim(), // Use original tech name for display
          normalized,
          ...iconConfig
        };
      }
      return null;
    })
    .filter((icon): icon is NonNullable<typeof icon> => icon !== null) // Remove null values with proper typing
    .slice(0, maxIcons); // Limit number of icons
    
  return availableIcons;
};


/**
 * Get company logo deterministically based on interview ID
 * Returns both logo path and company name
 */
export const getCompanyLogoForInterview = (id?: string): { logo: string; company: string } => {
  // Use deterministic selection based on ID to ensure consistency
  if (id) {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = hash % companyLogos.length;
    const company = companyLogos[index];
    const path = `/covers${company.logo}`;
    console.log('Generated company logo:', path, 'Company:', company.name, 'for ID:', id);
    return { logo: path, company: company.name };
  }
  // Fallback to first company if no ID provided
  const fallback = companyLogos[0];
  const path = `/covers${fallback.logo}`;
  console.log('Fallback company logo:', path, 'Company:', fallback.name);
  return { logo: path, company: fallback.name };
};

// Legacy function for backward compatibility
export const getRandomInterviewCover = (id?: string) => {
  return getCompanyLogoForInterview(id).logo;
};
