// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // ★ Turbopack のワークスペース誤検知を防ぐ（今回の警告対策）
  turbopack: {
    root: __dirname, // プロジェクトのルートを明示
  },

  // ★ TypeScript の型エラーもビルドは通す
  typescript: {
    ignoreBuildErrors: true,
  },

  basePath: "/webapp/CREW",
};

export default nextConfig;
