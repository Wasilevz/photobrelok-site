import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import MetaPixel from "@/components/MetaPixel";
import CookieBanner from "@/components/CookieBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://photobrelok-site.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "PHOTOBRELOK — подарок с вашими фото на плёнке Kodak",
  description:
    "Подарите день, который захочется пережить снова: брелок из катушки Kodak с 6–10 вашими фото. 250 лей. Макет бесплатно, оплата при получении, 1–2 дня.",
  openGraph: {
    title: "PHOTOBRELOK — 10 фото в 1 брелоке Kodak",
    description: "Личный подарок: ваши фото на плёнке внутри катушки Kodak. 250 лей, бесплатный макет до оплаты.",
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
    title: "PHOTOBRELOK — 10 фото в 1 брелоке Kodak",
    description: "Личный подарок: ваши фото на плёнке внутри катушки Kodak. 250 лей, бесплатный макет до оплаты.",
    images: ["/opengraph-image.png"],
  },
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
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Rubik:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/landing.css" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LanguageProvider>
          {children}
          <MetaPixel />
          <CookieBanner />
        </LanguageProvider>
      </body>
    </html>
  );
}
