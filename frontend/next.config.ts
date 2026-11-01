import type { NextConfig } from "next";

/** Địa chỉ API NestJS. Frontend gọi /api/* và /uploads/* cùng origin rồi Next chuyển tiếp sang đây (giữ cookie đăng nhập). */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BACKEND_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
