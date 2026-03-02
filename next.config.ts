import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/shops/:path*",
        destination: "/collections/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
