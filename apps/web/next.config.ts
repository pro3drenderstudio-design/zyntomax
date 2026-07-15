import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@zyntomax/db"],
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb", // scale/receipt photos upload through server actions
    },
  },
};

export default nextConfig;
