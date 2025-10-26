// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React Strict Mode to prevent double rendering in development
  reactStrictMode: false,

  // Environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  // Force dynamic rendering for error pages
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
};

// Ensure we're not using Turbopack
process.env.TURBOPACK = '0';

module.exports = nextConfig;
