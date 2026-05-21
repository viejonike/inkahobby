import type { NextConfig } from "next";

// For Capacitor builds: BUILD_MODE=capacitor next build
// For server builds: next build (default standalone)
const isCapacitorBuild = process.env.BUILD_MODE === 'capacitor';

const nextConfig: NextConfig = {
  output: isCapacitorBuild ? "export" : "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
