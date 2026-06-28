import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Receipts can be up to 5 MB; allow headroom for the rest of the form
      // (default is 1 MB, which a phone photo exceeds → "unexpected error").
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
