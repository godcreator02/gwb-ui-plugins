import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  redirects: async () => [
    { source: '/', destination: '/docs', permanent: true },
    // 轨迹卡 2026-09-12-token-nationalization 链的是令牌页的旧地址，卡只增不改
    { source: '/docs/tokens', destination: '/docs/shell/tokens', permanent: false },
  ],
};

export default withMDX(config);
