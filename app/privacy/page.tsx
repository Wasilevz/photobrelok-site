import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  title: "Политика конфиденциальности — PHOTOBRELOK",
  description:
    "Какие персональные данные собирает PHOTOBRELOK, зачем они нужны, кому передаются, сколько хранятся и как вы можете ими управлять.",
};

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
