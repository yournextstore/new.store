import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    ppr: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/iframe/:subdomain/:path*',
        destination: 'https://:subdomain.yns.cx/:path*',
      },
    ];
  },
};

export default nextConfig;
