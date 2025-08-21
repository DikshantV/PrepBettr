/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Azure App Service deployment
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  eslint: {
    // Temporarily ignore ESLint errors during build to check React icons fix
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.azurewebsites.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
  env: {
    ENVIRONMENT: process.env.ENVIRONMENT || 'development',
  },
  // Server-only packages that should not be bundled for client-side
  serverExternalPackages: [
    '@azure/cosmos',
    '@azure/storage-blob', 
    '@azure/keyvault-secrets',
    '@azure/identity',
    '@azure/app-configuration',
    'firebase-admin',
    'applicationinsights',
    '@grpc/grpc-js'
  ],
  experimental: {
    // Keep other experimental features here if needed
  },
  // Azure App Service configuration
  trailingSlash: false,
  
  // Custom webpack config for Azure packages
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      // Optimize server-side Azure packages
      config.externals = config.externals || [];
      config.externals.push({
        '@azure/msal-node': 'commonjs @azure/msal-node',
        '@azure/cosmos': 'commonjs @azure/cosmos',
        '@azure/storage-blob': 'commonjs @azure/storage-blob',
        '@azure/keyvault-secrets': 'commonjs @azure/keyvault-secrets',
      });
    }
    
    // Temporarily disable minification to resolve webpack error
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        minimize: false,
      };
    }
    
    return config;
  },
  
  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
