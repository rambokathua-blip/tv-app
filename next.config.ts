import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, max-age=0, must-revalidate",
        },
        {
          key: "CDN-Cache-Control",
          value: "no-store",
        },
        {
          key: "Vercel-CDN-Cache-Control",
          value: "no-store",
        },
      ],
    },
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
