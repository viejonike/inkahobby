import type { NextConfig } from "next";

// For Capacitor builds: BUILD_MODE=capacitor next build
// For Vercel deployment: next build (default - no output setting needed)
const isCapacitorBuild = process.env.BUILD_MODE === 'capacitor';

const nextConfig: NextConfig = {
  // Only use 'export' for Capacitor (static HTML for Android APK)
  // For Vercel, don't set output - Vercel handles it automatically
  ...(isCapacitorBuild ? { output: "export" as const } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
