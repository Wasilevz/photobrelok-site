import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "CRM · PHOTOBRELOK",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#F5F1E8] text-[#191715] font-sans">{children}</div>;
}
