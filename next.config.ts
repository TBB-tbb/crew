import type { NextConfig } from "next";

const nextConfig = {
  // ★ TypeScript の型エラーもビルドは通す
  typescript: {
    ignoreBuildErrors: true,
  },
  basePath: "/webapp/CREW",
};
export default nextConfig;
