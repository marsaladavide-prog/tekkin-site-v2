// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "dummyimage.com" },
      { protocol: "https", hostname: "*.supabase.co" },

      // aggiungi questi:
      { protocol: "https", hostname: "musictech.com" },
      { protocol: "https", hostname: "mixmag.net" },
      { protocol: "https", hostname: "djmag.com" },
      { protocol: "https", hostname: "*.residentadvisor.net" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: https:",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https:",
              "font-src 'self' https: data:",
              // consentiamo blob:/data: per audio caricati via objectURL/local
              "media-src 'self' blob: data: https:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};
export default nextConfig;
