import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-side only configuration (not exposed to browser)
  serverRuntimeConfig: {
    azureSpeechKey: process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY,
    azureSpeechRegion: process.env.AZURE_SPEECH_REGION || 'eastus2',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_VOICE_PROVIDER: process.env.NEXT_PUBLIC_VOICE_PROVIDER || 'azure',
  },
  serverExternalPackages: [
    'microsoft-cognitiveservices-speech-sdk',
    '@azure/identity',
    '@azure/keyvault-secrets'
  ],
  webpack: (config, { isServer }) => {
    // Enable production optimizations
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: true, // Enable minification for production builds
        minimizer: config.optimization.minimizer || [], // Keep default minimizers
      };
    }

    // Ignore canvas dependency warnings from linkedom/article-extractor
    config.ignoreWarnings = [
      { module: /node_modules\/linkedom\/commonjs\/canvas\.cjs/ },
      { message: /Can't resolve 'canvas'/ },
    ];

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
        net: false,
        tls: false,
        canvas: false, // Explicitly ignore canvas dependency
      };
    }

    return config;
  },
};

export default nextConfig;
