import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Allow deploys even if there are lint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow deploys even if there are type errors
    ignoreBuildErrors: true,
  },
  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          // Explicitly allow Web Serial API
          { key: "Permissions-Policy", value: "serial=(self)" },
          // Reasonable security headers for an SPA
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
