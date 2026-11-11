import type { Metadata, Viewport } from "next";
import { Rubik, Caveat } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import MetaPixel from "@/components/MetaPixel";
import CookieBanner from "@/components/CookieBanner";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["cyrillic", "latin"],
  weight: "700",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://photobrelok-site.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { canonical: "/" },
  title: "Брелок из катушки Kodak с вашими фото | PHOTOBRELOK",
  description:
    "6–10 ваших кадров на плёнке в катушке Kodak. 250 лей, макет бесплатно за 24 часа, брелок за 1–2 дня, оплата при получении.",
  openGraph: {
    title: "Брелок из катушки Kodak с вашими фото | PHOTOBRELOK",
    description: "6–10 ваших кадров на плёнке в катушке Kodak. 250 лей, макет бесплатно, оплата при получении.",
    url: siteUrl,
    siteName: "PHOTOBRELOK",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1353,
        height: 748,
        alt: "Фотобрелок из катушки Kodak с вашими фото",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Брелок из катушки Kodak с вашими фото | PHOTOBRELOK",
    description: "6–10 ваших кадров на плёнке в катушке Kodak. 250 лей, макет бесплатно, оплата при получении.",
    images: ["/opengraph-image.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      name: "PHOTOBRELOK — брелок из катушки Kodak с вашими фото",
      description: "Брелок из катушки Kodak с 6–10 вашими фотографиями на плёнке. Макет бесплатно, оплата при получении.",
      image: `${siteUrl}/opengraph-image.png`,
      brand: { "@type": "Brand", name: "PHOTOBRELOK" },
      offers: {
        "@type": "Offer",
        price: "250",
        priceCurrency: "MDL",
        availability: "https://schema.org/InStock",
        url: siteUrl,
      },
    },
    {
      "@type": "LocalBusiness",
      name: "PHOTOBRELOK",
      url: siteUrl,
      telephone: "+37378238455",
      email: "fotobrelokmd@gmail.com",
      address: {
        "@type": "PostalAddress",
        streetAddress: "ул. Alexander Bernardazzi, 64",
        addressLocality: "Chișinău",
        addressCountry: "MD",
      },
      openingHours: "Mo-Su 09:00-23:00",
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${rubik.variable} ${caveat.variable}`}>
      <head>
        <link rel="stylesheet" href="/landing.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <LanguageProvider>
          {children}
          <MetaPixel />
          <CookieBanner />
        </LanguageProvider>
      </body>
    </html>
  );
}
