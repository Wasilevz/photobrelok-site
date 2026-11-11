import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
  // Report-Only: сначала проверить Pixel, YouTube и Cloudinary, потом включить боевой CSP
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob: https://i.ytimg.com https://www.facebook.com https://res.cloudinary.com",
      "media-src 'self'",
      "connect-src 'self' https://api.cloudinary.com https://www.facebook.com https://connect.facebook.net",
      "frame-src https://www.youtube-nocookie.com",
      "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
