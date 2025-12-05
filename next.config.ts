import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "ydwmassfcxbi4xdn.public.blob.vercel-storage.com",
        // port is optional, default is ''
        // pathname is optional, default is '/**'
      },
    ],
  },
};

export default nextConfig;
