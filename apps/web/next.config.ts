import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@keystatic/core", "@keystatic/next"],
};

export default nextConfig;
