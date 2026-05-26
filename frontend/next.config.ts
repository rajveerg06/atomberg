import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Setup rewrites to proxy API requests to Flask backend to avoid CORS issues in local development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:5000/api/:path*",
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:5000/health",
      }
    ];
  },
};

export default nextConfig;
