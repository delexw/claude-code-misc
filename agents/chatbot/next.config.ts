import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling packages that spawn processes or use native modules
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "@a2a-js/sdk", "express"],
  // Pin the workspace root to this package to suppress the multiple-lockfiles warning.
  // Next.js walks up the directory tree looking for a root lockfile; without this it
  // may pick up a lockfile from a parent directory (/Users/yang.liu/package-lock.json).
  turbopack: {
    // Set root to agents/ so Turbopack can resolve ../tsconfig.json from chatbot/tsconfig.json,
    // while still excluding the user's home-directory lockfiles from workspace detection.
    root: path.resolve(__dirname, ".."),
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@@": path.resolve(__dirname, ".."),
    };
    return config;
  },
};

export default nextConfig;
