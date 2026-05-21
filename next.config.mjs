// basePath 由部署时的 BASE_PATH 环境变量注入（如 /personable）。
// 本地 dev/build 不设此变量时，basePath 为空、行为保持向后兼容。
const basePath = process.env.BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  basePath: basePath || undefined,
  // 透出给客户端 fetch 拼前缀（必须以 NEXT_PUBLIC_ 开头）
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  // 旧版分享路径 /c/<id> 永久重定向到 /persona/<id>，保证 7 天 TTL 内
  // 已经分享出去的链接不失效。spec: persona-card「访问旧 /c/<id> 路径」。
  async redirects() {
    return [
      {
        source: "/c/:id",
        destination: "/persona/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
