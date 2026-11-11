import LandingSwitch from "@/components/LandingSwitch";
import { faqCopy } from "@/lib/landing-copy";

// Разметка FAQPage: те же вопросы, что видны на странице (в Landing вопрос с индексом 2 скрыт)
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqCopy.ru
    .filter((_, i) => i !== 2)
    .map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
};

// LandingSwitch показывает прежний Landing, а новый макет (LandingV2) только по флагу (lib/layout-flag.ts)
export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingSwitch />
    </>
  );
}
