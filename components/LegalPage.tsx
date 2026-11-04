"use client";

import { useLanguage } from "@/context/LanguageContext";
import { legalCopy } from "@/lib/legal-copy";
import LegalDocView from "./LegalDocView";

export default function LegalPage({ kind }: { kind: "privacy" | "cookies" }) {
  const { lang } = useLanguage();
  return <LegalDocView doc={legalCopy[lang][kind]} />;
}
