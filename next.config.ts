import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
    resolveAlias: {
      fs: {
        browser: "./src/features/board/browser-empty.ts",
      },
    },
  },
};

export default nextConfig;
