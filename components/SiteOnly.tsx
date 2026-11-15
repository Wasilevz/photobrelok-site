"use client";

import { usePathname } from "next/navigation";

/** Показывает содержимое только на сайте, не в CRM (/crm): там не нужны баннер cookies и пиксель. */
export default function SiteOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/crm")) return null;
  return <>{children}</>;
}
