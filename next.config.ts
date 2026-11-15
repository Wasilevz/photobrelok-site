import type { NextConfig } from "next";

const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Report-Only: сначала проверить Pixel, YouTube и Cloudinary, потом включить боевой CSP
function csp(frameAncestors: string) {
  return {
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
      `frame-ancestors ${frameAncestors}`,
    ].join("; "),
  };
}

// Сайт нельзя встраивать в чужие фреймы. Исключение — /crm: Telegram Web (web.telegram.org)
// открывает Mini App во фрейме, с X-Frame-Options: DENY CRM там не откроется.
const siteHeaders = [...baseHeaders, { key: "X-Frame-Options", value: "DENY" }, csp("'none'")];
const crmHeaders = [...baseHeaders, csp("https://web.telegram.org https://*.telegram.org")];

const nextConfig: NextConfig = {
  // Шаблоны почтовых бланков и шрифт читаются с диска во время запроса — их надо положить в функцию.
  outputFileTracingIncludes: {
    "/api/crm/post-forms/file": ["./lib/crm/post-forms/assets/**"],
  },
  async headers() {
    return [
      { source: "/", headers: siteHeaders },
      { source: "/:path((?!crm$|crm/).*)", headers: siteHeaders },
      { source: "/crm", headers: crmHeaders },
      { source: "/crm/:path*", headers: crmHeaders },
    ];
  },
};

export default nextConfig;
