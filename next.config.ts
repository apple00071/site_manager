// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React Strict Mode to catch hydration issues in development
  reactStrictMode: true,

  // Environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  // Force dynamic rendering for error pages
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },

  // Experimental features to help with hydration
  experimental: {
    optimizePackageImports: ['react-icons'],
  },

  // Server external packages (moved from experimental in Next.js 16)
  serverExternalPackages: ['@supabase/supabase-js'],

  // Image Configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uswdtcmemgfqlkzmfkxs.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },


  // Compiler options
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? true : false,
  },

  // Webpack configuration for better error handling
  webpack: (config: any, { dev, isServer }: { dev: boolean; isServer: boolean }) => {
    if (dev && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'react-dom$': 'react-dom/profiling',
        'scheduler/tracing': 'scheduler/tracing-profiling',
      };
    }
    return config;
  },

  // Output configuration
  output: 'standalone',

  // Headers for PWA files and App Links
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        // Android App Links - Digital Asset Links
        source: '/.well-known/assetlinks.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
      {
        // iOS Universal Links - Apple App Site Association (without extension)
        source: '/.well-known/apple-app-site-association',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
    ];
  },
};

// Ensure we're not using Turbopack
process.env.TURBOPACK = '0';

module.exports = nextConfig;
