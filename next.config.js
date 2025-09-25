const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
});
const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Azure App Service deployment
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  eslint: {
    // Temporarily ignore ESLint errors during build to check React icons fix
    ignoreDuringBuilds: true,
  },
  // Temporarily disable error page generation
  async generateBuildId() {
    return 'prepbettr-firebase-azure-kv-integration';
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
    // Disable static optimization to avoid Html import issues
    disableOptimizedLoading: true
  },
  skipMiddlewareUrlNormalize: true,
  // Azure App Service configuration
  trailingSlash: false,
  // Disable static page generation for error pages
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Custom webpack config for Azure packages
  webpack: (config, { isServer, dev }) => {
    // Global polyfill for 'self' issue fix
    config.plugins = config.plugins || [];
    
    if (isServer) {
      // Server-side: Replace 'self' with globalThis
      config.plugins.push(
        new webpack.DefinePlugin({
          self: 'globalThis',
        })
      );
    }
    
    // Exclude Azure Functions from build
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /azure\/.*\/index\.ts$/,
      use: 'null-loader',
    });
    
    if (isServer) {
      // Optimize server-side Azure packages
      config.externals = config.externals || [];
      config.externals.push({
        '@azure/msal-node': 'commonjs @azure/msal-node',
        '@azure/cosmos': 'commonjs @azure/cosmos',
        '@azure/storage-blob': 'commonjs @azure/storage-blob',
        '@azure/keyvault-secrets': 'commonjs @azure/keyvault-secrets',
        '@azure/functions': 'commonjs @azure/functions',
      });
    } else {
      // Client-side fallbacks for Node.js modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        http2: false,
        dns: false,
        assert: false,
        os: false,
        path: false,
        child_process: false,
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
            value: 'unsafe-none',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
          {
            key: 'Content-Security-Policy',
            value: "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com https://*.paypalobjects.com https://apis.google.com https://www.gstatic.com https://*.googleapis.com; frame-src 'self' https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com https://accounts.google.com https://*.firebaseapp.com https://prepbettr.firebaseapp.com; connect-src 'self' https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com https://*.paypalobjects.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.googleapis.com https://accounts.google.com https://*.firebaseapp.com https://prepbettr.firebaseapp.com;",
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
