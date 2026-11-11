import LandingV2 from "@/components/LandingV2";
import { faqCopy } from "@/lib/landing-copy";
import { landingV2Copy } from "@/lib/landing-v2-copy";

// Разметка FAQPage: ровно те вопросы и формулировки, что видны на странице (см. блок «Вопросы» в LandingV2)
const v = landingV2Copy.ru;
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: v.faqPick.map((idx) => ({
    "@type": "Question",
    name: (v.faqQ as Record<number, string>)[idx] ?? faqCopy.ru[idx].q,
    acceptedAnswer: { "@type": "Answer", text: faqCopy.ru[idx].a },
  })),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingV2 />
    </>
  );
}
