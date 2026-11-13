import type { NextConfig } from "next";

/** Địa chỉ API NestJS. Frontend gọi /api/* và /uploads/* cùng origin rồi Next chuyển tiếp sang đây (giữ cookie đăng nhập). */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BACKEND_URL}/uploads/:path*` },
      // Landing 3D "Trải nghiệm" là trang HTML tĩnh độc lập (Three.js + WebGL), không đi qua React: public/trai-nghiem/index.html
      { source: "/trai-nghiem", destination: "/trai-nghiem/index.html" },
    ];
  },
};

export default nextConfig;
