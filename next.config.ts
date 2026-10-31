import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    // Client/brand logos are uploaded to Cloudinary (see
    // lib/cloudinary-server.ts) and rendered via next/image in shared
    // components like lib/clients/ClientMark.tsx — next/image refuses any
    // remote host that isn't explicitly allow-listed, and none was
    // configured before this, so any client with a real logoUrl already
    // broke rendering wherever ClientMark was used. Not scoped to one
    // cloud name, since NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is configurable.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
