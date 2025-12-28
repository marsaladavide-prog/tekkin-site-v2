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
                    { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",

              // immagini
              "img-src 'self' data: blob: https:",

              // script
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https:",

              // stili
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

              // font
              "font-src 'self' https://fonts.gstatic.com data:",

              // fetch / ws (Supabase realtime incluso)
              "connect-src 'self' https: wss: https://*.supabase.co wss://*.supabase.co",

              // audio
              "media-src 'self' blob: data: https:",

              // iframe esterni
              "frame-src https://open.spotify.com",
              "child-src https://open.spotify.com",

              // chi può incorniciare TEKKIN (sicurezza moderna)
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};
export default nextConfig;
