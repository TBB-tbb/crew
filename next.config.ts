/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
    // ★ Turbopack のワークスペース誤検知を防ぐ（今回の警告対策）
  turbopack: {
    root: __dirname, // プロジェクトのルートを明示
  },

  // ★ ビルド時は ESLint を無視
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ★ 型エラーがあってもビルド続行
  typescript: {
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
  basePath: '/webapp/CREW',   // ← サブパスに合わせる
};