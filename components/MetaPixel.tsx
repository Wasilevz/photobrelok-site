"use client";

import { useEffect } from "react";
import { loadMetaPixel } from "@/lib/meta";
import { useConsent } from "@/lib/consent";

/**
 * Пиксель Meta грузится только после согласия на маркетинг.
 * Без согласия компонент ничего не рендерит и никуда не обращается.
 */
export default function MetaPixel() {
  const { consent } = useConsent();
  const marketing = consent?.marketing ?? false;

  useEffect(() => {
    if (marketing) loadMetaPixel();
  }, [marketing]);

  return null;
}
