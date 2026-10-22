"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import PhotoConstructor from "@/components/PhotoConstructor";
import { useLanguage } from "@/context/LanguageContext";
import {
  ADDRESS,
  EMAIL,
  PRICE_MDL,
  TELEGRAM_PHONE,
  TELEGRAM_PHONE_DISPLAY,
  TELEGRAM_URL,
  telegramLink,
} from "@/lib/contacts";
import { track } from "@/lib/analytics";
import { landingCopy, faqCopy, occasionCopy } from "@/lib/landing-copy";
import { UrgencyBanner, DailyCutoff, SlotsLeft } from "@/components/Urgency";
import { useOccasion } from "@/lib/occasion-store";

const memories = [
  { src: "/images/gallery-1.jpg", alt: "Брелки на красной ткани со свечами / Brelocuri pe pânză roșie" },
  { src: "/images/gallery-2.jpg", alt: "Брелок-плёнка в руках / Breloc-film în mâini" },
  { src: "/images/gallery-3.jpg", alt: "Брелки-катушки на фоне цветов / Brelocuri lângă flori" },
  { src: "/images/gallery-4.jpg", alt: "Брелок с фото в руках / Breloc cu poze în mâini" },
  { src: "/images/gallery-5.jpg", alt: "Плёнка с семейными фото / Film cu poze de familie" },
];

const reviewShots = [
  {
    src: "/images/reviews/img_4352.jpg",
    alt: "Сторис клиента: брелок-плёнка, доставка 2–3 дня / Story client: breloc-film",
  },
  {
    src: "/images/reviews/img_4353.jpg",
    alt: "Отзыв: упаковка и брелок-плёнка / Recenzie: ambalaj și breloc-film",
  },
  {
    src: "/images/reviews/img_4354.jpg",
    alt: "Клиентка с брелком-плёнкой / Clientă cu breloc-film",
  },
  {
    src: "/images/reviews/img_4356.jpg",
    alt: "Сообщения клиентов о заказе / Mesaje de la clienți",
  },
  {
    src: "/images/reviews/img_4357.jpg",
    alt: "Благодарность за подарок / Mulțumiri pentru cadou",
  },
  {
    src: "/images/reviews/img_4358.jpg",
    alt: "Отзыв на румынском о брелоке / Recenzie în română",
  },
];

const exampleMeta = [
  { src: "/images/card-love.jpg", alt: "Пара с брелком-плёнкой / Pereche cu breloc-film" },
  { src: "/images/card-family.jpg", alt: "Семейные фото на плёнке / Poze de familie pe film" },
  { src: "/images/card-pets.jpg", alt: "Брелок с фото питомцев / Breloc cu animale" },
  { src: "/images/card-achievement.jpg", alt: "Брелок с фото выпускников / Breloc absolvire" },
];

const tgOrder = telegramLink("Здравствуйте! Хочу брелок.");

export default function Landing() {
  const { lang, setLang } = useLanguage();
  const { occasion, setOccasion } = useOccasion();
  const t = landingCopy[lang];
  const faq = faqCopy[lang];
  const occasions = occasionCopy[lang];
  const [mobileCtaHidden, setMobileCtaHidden] = useState(false);
  const builderRef = useRef<HTMLElement>(null);

  useEffect(() => {
    track("hero_view");
    const el = builderRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setMobileCtaHidden(entry.isIntersecting),
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scrollToBuilder = () => {
    track("hero_cta");
    track("builder_start");
    const el = document.getElementById("constructor") || document.getElementById("builder");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="pb">
      <header className="hd">
        <div className="wrap">
          <a className="logo" href="#top">
            PHOTO<span>BRELOK</span>
          </a>
          <nav className="hd-actions" aria-label={lang === "ru" ? "Меню" : "Meniu"}>
            <a className="btn btn-ghost btn-sm hd-nav" href="#how">
              {t.howNav}
            </a>
            <a className="btn btn-ghost btn-sm hd-nav" href="#reviews">
              {t.reviewsNav}
            </a>
            <a
              className="btn btn-primary btn-sm hd-order"
              href={tgOrder}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.orderNav}
            </a>
            <button
              type="button"
              className="lang-btn"
              data-testid="lang-switch"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLang(lang === "ru" ? "ro" : "ru");
              }}
              aria-label={lang === "ru" ? "Schimbă limba în română" : "Переключить на русский"}
            >
              {lang === "ru" ? "RO" : "RU"}
            </button>
          </nav>
        </div>
      </header>
      <UrgencyBanner />

      <main id="top">
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">{t.eyebrow}</p>
              <h1>{t.heroTitle}</h1>
              <p className="lead">{t.heroLead}</p>
              <ul className="hero-meta">
                <li>
                  <strong>{t.priceChip}</strong>
                </li>
              </ul>
              <p className="hero-terms">{t.termsLine}</p>
              <div className="hero-actions">
                <button type="button" className="btn btn-primary" onClick={scrollToBuilder}>
                  {t.heroCta}
                </button>
                <a className="btn btn-quiet" href="#how">
                  {t.heroSecondary}
                </a>
              </div>
              <p className="hero-cta-note">{t.heroCtaNote}</p>
              <DailyCutoff />
              <SlotsLeft />
            </div>

            <div className="hero-visual">
              {/* TODO: hero video loop 5–8s (muted, playsinline, poster ≤150KB WebP) — owner to supply */}
              <Image
                className="photo-main"
                src="/images/hero-keychain.jpg"
                alt={
                  lang === "ru"
                    ? "Брелок-катушка Kodak с фото на красном шарфе"
                    : "Breloc-casetă Kodak cu poze pe eșarfă roșie"
                }
                width={600}
                height={900}
                priority
              />
            </div>
          </div>
        </section>

        <section id="pain">
          <div className="wrap center">
            <h2>{t.painTitle}</h2>
            <p className="lead">{t.painLead}</p>
            <p className="hand" style={{ fontSize: 32, marginTop: 8 }}>
              {t.painHand}
            </p>
          </div>
        </section>

        <section className="examples" id="occasions">
          <div className="wrap">
            <h2>{t.occTitle}</h2>
            <p className="lead">{t.occLead}</p>
            <div className="gallery occ-rail">
              {occasions.map((item, i) => (
                <figure key={item.title}>
                  <Image
                    src={exampleMeta[i].src}
                    alt={exampleMeta[i].alt}
                    width={900}
                    height={600}
                    loading="lazy"
                  />
                  <figcaption>
                    <div>
                      <strong style={{ display: "block", fontSize: 18, marginBottom: 6 }}>
                        {item.title}
                      </strong>
                      {item.text}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm occ-btn"
                        onClick={() => {
                          setOccasion(item.title);
                          track("select_occasion", { occasion: item.title });
                          const el = document.getElementById("constructor") || document.getElementById("builder");
                          el?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        {lang === "ru" ? "Выбрать" : "Alege"}
                      </button>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="gift" className="final" style={{ background: "var(--ink)" }}>
          <div className="wrap center">
            <h2>{t.giftTitle}</h2>
            <p className="lead">{t.giftLead}</p>
          </div>
        </section>

        <section className="builder" id="builder" ref={builderRef}>
          <div className="wrap">
            <h2>{t.builderTitle}</h2>
            <p className="lead">{t.builderLead}</p>
            {occasion ? (
              <div className="occasion-chip" role="status">
                {t.occasionSelected}: {occasion}
                <button type="button" className="occasion-chip-x" onClick={() => setOccasion("")}>
                  · {t.occasionChange}
                </button>
              </div>
            ) : null}
          </div>
          <PhotoConstructor />
        </section>
        <section>
          <div className="wrap">
            <div className="price">
              <p className="price-label">{t.priceTitle}</p>
              <div className="big">{t.priceBig}</div>
              <p className="price-text">{t.priceText}</p>
              <div className="include-box">
                <p className="include-title">{t.includeTitle}</p>
                <p className="include-lead">{t.includeLead}</p>
                <ul className="include-list">
                  {t.includeItems.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="badge-row">
                  <span className="trust-badge">✓ {t.mockupBadge}</span>
                  <span className="trust-badge">✓ {t.payBadge}</span>
                  <span className="trust-badge">✓ {lang === "ru" ? "1000 сворачиваний" : "1000 de răsuciri"}</span>
                </div>
                <p className="pair-offer">{t.pairOffer}</p>
              </div>
              <a
                className="btn btn-primary"
                href={telegramLink(
                  lang === "ru"
                    ? "Здравствуйте! Хочу такой брелок."
                    : "Bună ziua! Vreau un astfel de breloc."
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.priceCta}
              </a>
              <p className="guar">
                <strong>{t.guarPeaceLabel}</strong> {t.guarPeaceText}
              </p>
              <p className="guar">
                <strong>{t.guarDurabilityLabel}</strong> {t.guarDurabilityText}
              </p>
            </div>
          </div>
        </section>

        {/* Memories — horizontal swipe */}
        <section className="memories" id="memories">
          <div className="wrap center">
            <h2>{t.memoriesTitle}</h2>
            <div
              className="memories-rail"
              tabIndex={0}
              aria-label={lang === "ru" ? "Фотографии готовых брелоков" : "Fotografii brelocuri gata"}
            >
              {memories.map((item) => (
                <figure key={item.src}>
                  <Image src={item.src} alt={item.alt} width={800} height={1000} loading="lazy" />
                </figure>
              ))}
            </div>
            <p className="memories-hint">{t.memoriesHint}</p>
          </div>
        </section>

        <section id="reviews" className="reviews-sec">
          <div className="wrap">
            <h2>{t.reviewsTitle}</h2>
            <p className="lead">{t.reviewsLead}</p>


            {/* TODO: photo/video of gift reaction (name + city) — owner to supply */}
            <div className="review-gift-slot" aria-label="Отзыв о вручении подарка">
              <span>
                {lang === "ru"
                  ? "Фото или видео с реакцией на подарок — здесь (TODO)"
                  : "Fotografie sau video cu reacția la cadou — aici (TODO)"}
              </span>
            </div>
            <div className="reviews-wall occ-rail" aria-label={t.reviewsTitle}>
              {reviewShots.map((shot) => (
                <figure key={shot.src} className="review-shot">
                  <Image src={shot.src} alt={shot.alt} width={1200} height={1800} loading="lazy" />
                </figure>
              ))}
            </div>

            <p className="memories-hint">{t.reviewsHint}</p>
          </div>
        </section>

        {/* Video instruction — anchor target for «Как это работает» */}
        <section id="how" className="video-sec">
          <div className="wrap center">
            <h2>{t.howUseTitle}</h2>
            <p className="lead">{t.howUseLead}</p>

            <div className="video-shell">
              <iframe
                src="https://www.youtube-nocookie.com/embed/ghOptgciqEU?rel=0&modestbranding=1&playsinline=1"
                title={t.howUseTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>

            <p className="video-hint">{t.howUseHint}</p>

            <div className="steps steps-under-video">
              <article className="step">
                <div className="step-num">1</div>
                <h3>{t.step1}</h3>
                <p>{t.step1t}</p>
              </article>
              <article className="step">
                <div className="step-num">2</div>
                <h3>{t.step2}</h3>
                <p>{t.step2t}</p>
              </article>
              <article className="step">
                <div className="step-num">3</div>
                <h3>{t.step3}</h3>
                <p>{t.step3t}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="faq" id="faq">
          <div className="wrap-narrow">
            <h2>{t.faqTitle}</h2>
            {faq.map((item, i) => {
              const isOpen = i < 2 || /не понравится|nu-mi place/i.test(item.q);
              return (
                <div className="faq-item" key={item.q}>
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={isOpen}
                    onClick={(e) => {
                      const btn = e.currentTarget;
                      const panel = btn.nextElementSibling as HTMLElement | null;
                      const open = btn.getAttribute("aria-expanded") === "true";
                      btn.setAttribute("aria-expanded", open ? "false" : "true");
                      if (panel) panel.hidden = open;
                    }}
                  >
                    <span>{item.q}</span>
                    <span aria-hidden="true">{isOpen ? "–" : "+"}</span>
                  </button>
                  <div className="faq-a" hidden={!isOpen}>
                    <p>{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="final" id="order">
          <div className="wrap center">
            <h2>{t.finalTitle}</h2>
            <p className="lead">{t.finalLead}</p>
            <div className="hero-actions" style={{ justifyContent: "center" }}>
              <button type="button" className="btn btn-primary" onClick={scrollToBuilder}>
                {t.finalTg}
              </button>
              <a
                className="btn btn-ghost"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                href={`tel:${TELEGRAM_PHONE}`}
              >
                {t.finalCall} {TELEGRAM_PHONE_DISPLAY}
              </a>
            </div>
            <p className="final-note">{t.finalNote}</p>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap foot-grid">
          <div>
            <div className="logo" style={{ fontSize: 32, marginBottom: 10 }}>
              PHOTO<span style={{ color: "var(--accent)" }}>BRELOK</span>
            </div>
            <p style={{ margin: 0 }}>
              {t.footerLoc} {ADDRESS}.
            </p>
          </div>
          <div className="stack-2">
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            <a href={`tel:${TELEGRAM_PHONE}`}>{TELEGRAM_PHONE_DISPLAY}</a>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
              Telegram
            </a>
            {/* TODO: Viber / WhatsApp links — owner to supply */}
            <span className="small muted">Viber / WhatsApp — TODO</span>
            <a href="#builder">{t.seeBrelok}</a>
          </div>
        </div>
      </footer>

      <div className={`mobile-cta ${mobileCtaHidden ? "hidden" : ""}`}>
        <div className="price-wrap">
          <div className="price">{t.mobileCtaLead}</div>
          <div className="small muted">
            {t.priceChip} · {t.mobilePriceNote}
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={scrollToBuilder}>
          {t.seeBrelok}
        </button>
      </div>
    </div>
  );
}
