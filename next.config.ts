import type { NextConfig } from "next";

const nextConfig = {
  output: "export",
  images: { unoptimized: true },

  // ★ ESLint をビルド時は無視
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ★ TypeScript の型エラーもビルドは通す
  typescript: {
    ignoreBuildErrors: true,
  },
  basePath: "/webapp/CREW",
  trailingSlash: true,
};
export default nextConfig;
