import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@zyntomax/db"],
  // Monorepo: trace from the repo root so workspace packages are included.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // pnpm nests the generated Prisma client + native query engine deep in the
  // virtual store, which Next's tracer misses — force the engine into the bundle.
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**/*",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb", // scale/receipt photos upload through server actions
    },
  },
};

export default nextConfig;
