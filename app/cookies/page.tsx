import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Политика cookie — PHOTOBRELOK",
  description:
    "Какие cookie и похожие технологии использует PHOTOBRELOK, для чего они нужны, сколько живут и как ими управлять.",
};

export default function CookiesPage() {
  return <LegalPage kind="cookies" />;
}
