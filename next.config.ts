import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // /_next/* (JS/CSS/HMR) resources so the preview tab renders correctly.
  allowedDevOrigins: ["localhost:3000", "127.0.0.1:3000", "0.0.0.0:3000"],
};

export default nextConfig;
