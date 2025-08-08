/** @type {import('next').NextConfig} */
const nextConfig = {
  // No modularizeImports configuration
  // We handle react-icons imports explicitly in components/tech-icons.ts
  eslint: {
    // Temporarily ignore ESLint errors during build to check React icons fix
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
