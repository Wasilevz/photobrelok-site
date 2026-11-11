import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://photobrelok-site.vercel.app");

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/cookies"].map((path) => ({ url: `${siteUrl}${path}` }));
}
