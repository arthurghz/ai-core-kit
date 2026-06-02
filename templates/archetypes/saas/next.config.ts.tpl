// Next.js config for ${project.name}.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` emits a self-contained server bundle (.next/standalone) that the
  // Dockerfile copies for a tiny production image. Keep it on for `docker build`.
  output: "standalone",
  // Add domains for next/image, experimental flags, etc. as the product needs.
};

export default nextConfig;
