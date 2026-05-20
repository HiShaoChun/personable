/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
