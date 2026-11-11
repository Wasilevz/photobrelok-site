"use client";

// Новый макет главной (Пакет 4, «Quiet Conversion»): 7 секций вместо 11.
// Включается флагом (см. lib/layout-flag.ts). Прежний Landing.tsx не менялся.
// Конструктор, форма заказа и API используются те же, что и раньше.
import "./landing-v2.css";
import Image from "next/image";
import Link from "next/link";
import { Lora } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import PhotoConstructor from "@/components/PhotoConstructor";
import { useLanguage } from "@/context/LanguageContext";
import {
  EMAIL,
  TELEGRAM_PHONE,
  TELEGRAM_PHONE_DISPLAY,
  TELEGRAM_URL,
  INSTAGRAM_URL,
  INSTAGRAM_DM_URL,
  telegramLink,
} from "@/lib/contacts";
import { track } from "@/lib/analytics";
import { landingCopy, faqCopy } from "@/lib/landing-copy";
import { landingV2Copy } from "@/lib/landing-v2-copy";
import { legalCopy } from "@/lib/legal-copy";
import { useConsent } from "@/lib/consent";
import { captureSource } from "@/lib/source";

const lora = Lora({
  subsets: ["cyrillic", "latin", "latin-ext"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-lora",
});

type Lang = "ru" | "ro";

const examples = [
  { src: "/images/card-love.jpg", alt: "Пара с брелком-плёнкой / Pereche cu breloc-film" },
  { src: "/images/card-family.jpg", alt: "Семейные фото на плёнке / Poze de familie pe film" },
  { src: "/images/card-pets.jpg", alt: "Брелок с фото питомцев / Breloc cu animale" },
  { src: "/images/card-achievement.jpg", alt: "Брелок с фото выпускников / Breloc absolvire" },
];

const gallery = [
  { src: "/images/gallery-1.jpg", alt: "Брелки на красной ткани со свечами / Brelocuri pe pânză roșie" },
  { src: "/images/gallery-2.jpg", alt: "Брелок-плёнка в руках / Breloc-film în mâini" },
  { src: "/images/gallery-3.jpg", alt: "Брелки-катушки на фоне цветов / Brelocuri lângă flori" },
  { src: "/images/gallery-4.jpg", alt: "Брелок с фото в руках / Breloc cu poze în mâini" },
  { src: "/images/gallery-5.jpg", alt: "Плёнка с семейными фото / Film cu poze de familie" },
];

const reviewShots = [
  { src: "/images/reviews/img_4352.jpg", alt: "Сторис клиента: брелок-плёнка / Story client: breloc-film" },
  { src: "/images/reviews/img_4353.jpg", alt: "Отзыв: упаковка и брелок-плёнка / Recenzie: ambalaj și breloc-film" },
  { src: "/images/reviews/img_4354.jpg", alt: "Клиентка с брелком-плёнкой / Clientă cu breloc-film" },
  { src: "/images/reviews/img_4356.jpg", alt: "Сообщения клиентов о заказе / Mesaje de la clienți" },
  { src: "/images/reviews/img_4357.jpg", alt: "Благодарность за подарок / Mulțumiri pentru cadou" },
  { src: "/images/reviews/img_4358.jpg", alt: "Отзыв на румынском о брелоке / Recenzie în română" },
];

/** Двуязычные alt хранятся как «RU / RO»: скринридеру отдаём только язык интерфейса */
const altFor = (alt: string, lang: Lang) => {
  const [ru, ro] = alt.split(" / ");
  return lang === "ro" ? (ro ?? ru) : ru;
};

const YT_ID = "ghOptgciqEU";

/** Короткая петля без звука: плёнка вытягивается из брелока. Автоплей только если разрешено системой. */
function HeroLoop({ label, pauseLabel, playLabel }: { label: string; pauseLabel: string; playLabel: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const userPaused = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      userPaused.current = true;
      return;
    }
    video.play().catch(() => {});
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!userPaused.current) video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().catch(() => {});
    } else {
      userPaused.current = true;
      video.pause();
    }
  };

  return (
    <div className="v2-hero-media">
      <video
        ref={videoRef}
        className="v2-hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/media/hero-poster-pull.jpg"
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src="/media/hero-loop.mp4" type="video/mp4" />
      </video>
      <button type="button" className="v2-pause" onClick={toggle} aria-label={playing ? pauseLabel : playLabel}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5v14l11-7z" />}
        </svg>
      </button>
    </div>
  );
}

function SectionLabel({ n, text }: { n: number; text: string }) {
  return (
    <p className="v2-label">
      <span>Кадр {String(n).padStart(2, "0")} / 07</span>
      <span className="v2-label-line" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

export default function LandingV2() {
  const { lang, setLang } = useLanguage();
  const t = landingCopy[lang];
  const v = landingV2Copy[lang];
  const faq = faqCopy[lang];
  const { decided: cookiesDecided } = useConsent();

  const [mobileCtaHidden, setMobileCtaHidden] = useState(false);
  const [heroCtaVisible, setHeroCtaVisible] = useState(true);
  const [photoCount, setPhotoCount] = useState(0);
  const [ytOpen, setYtOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number[]>([]);
  const builderRef = useRef<HTMLElement>(null);
  const heroCtaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    track("hero_view", { layout: "v2" });
    captureSource();
    const onSlots = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === "number") setPhotoCount(detail);
    };
    window.addEventListener("photobrelok_slots", onSlots);

    let builderIo: IntersectionObserver | null = null;
    let heroIo: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      if (builderRef.current) {
        builderIo = new IntersectionObserver(([entry]) => setMobileCtaHidden(entry.isIntersecting), { threshold: 0.15 });
        builderIo.observe(builderRef.current);
      }
      if (heroCtaRef.current) {
        heroIo = new IntersectionObserver(([entry]) => setHeroCtaVisible(entry.isIntersecting), { threshold: 0.6 });
        heroIo.observe(heroCtaRef.current);
      }
    }
    return () => {
      window.removeEventListener("photobrelok_slots", onSlots);
      builderIo?.disconnect();
      heroIo?.disconnect();
    };
  }, []);

  const scrollToBuilder = (source: string) => {
    track("hero_cta", { source, layout: "v2" });
    const el = document.getElementById("constructor") || document.getElementById("builder");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const ctaLabel = t.heroCta; // «Собрать брелок» / «Creează-ți brelocul»

  return (
    <div className={`pb pb2 ${lora.variable}`}>
      <a className="skip-link" href="#top">
        {v.skip}
      </a>
      <header className="hd">
        <div className="wrap hd-bar">
          <a className="logo" href="#top">
            PHOTO<span>BRELOK</span>
          </a>
          <nav className="hd-actions" aria-label={lang === "ru" ? "Язык" : "Limbă"}>
            <button
              type="button"
              className="lang-btn"
              data-testid="lang-switch"
              onClick={() => setLang(lang === "ru" ? "ro" : "ru")}
              aria-label={v.langAria}
            >
              <span lang={lang === "ro" ? "ru" : "ro"}>{v.langShort}</span>
            </button>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* 1. Hero: продукт в действии, понятный результат, цена, одна кнопка */}
        <section className="v2-hero">
          <div className="v2-wrap v2-hero-grid">
            <div className="v2-hero-copy">
              <p className="v2-eyebrow">{v.heroEyebrow}</p>
              <h1 className="v2-h1">{v.heroTitle}</h1>
              <p className="v2-lead">{v.heroLead}</p>
              <p className="v2-price">
                <strong>{t.heroPrice}</strong>
                <span>{t.heroPriceNote}</span>
              </p>
              <button type="button" ref={heroCtaRef} className="hero-cta-btn v2-cta" onClick={() => scrollToBuilder("hero")}>
                <span>{photoCount >= 6 ? t.priceCta : ctaLabel}</span>
                <span aria-hidden="true">→</span>
              </button>
              <p className="v2-note">{v.heroCtaNote}</p>
              <p className="v2-conditions">{v.heroConditions}</p>
            </div>
            <HeroLoop label={v.heroVideoLabel} pauseLabel={v.pause} playLabel={v.play} />
          </div>
        </section>

        {/* 2. Как это работает: три шага и ролик «30 секунд» (по клику, без автозагрузки YouTube) */}
        <section className="v2-section v2-steps" id="how">
          <div className="v2-wrap">
            <SectionLabel n={2} text={v.stepsLabel} />
            <h2 className="v2-h2">{v.stepsTitle}</h2>
            <p className="v2-story">{v.story}</p>
            <ol className="v2-step-list">
              {v.steps.map((s, i) => (
                <li key={s.title} className="v2-step">
                  <span className="v2-step-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3 className="v2-h3">{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
            <div className="v2-video">
              {ytOpen ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${YT_ID}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${YT_ID}`}
                  title={v.watch}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <button
                  type="button"
                  className="v2-video-btn"
                  onClick={() => {
                    setYtOpen(true);
                    track("video_play", { source: "how" });
                  }}
                >
                  {/* Своё фото вместо превью YouTube: до нажатия нет запросов к сторонним сервисам */}
                  <Image src="/images/gallery-2.jpg" alt="" fill sizes="(max-width: 767px) 100vw, 720px" loading="lazy" />
                  <span className="v2-video-label">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    {v.watch}
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 3. Конструктор: тот же компонент, что и раньше */}
        <section className="v2-section v2-builder" id="builder" ref={builderRef}>
          <div className="v2-wrap">
            <SectionLabel n={3} text={v.builderLabel} />
            <h2 className="v2-h2">{v.builderTitle}</h2>
            <p className="v2-lead">{v.builderLead}</p>
          </div>
          <PhotoConstructor />
        </section>

        {/* 4. Работы и отзывы */}
        <section className="v2-section v2-proof" id="reviews">
          <div className="v2-wrap">
            <SectionLabel n={4} text={v.proofLabel} />
            <h2 className="v2-h2">{v.examplesTitle}</h2>
          </div>
          <div className="v2-rail" tabIndex={0} role="region" aria-label={v.examplesTitle}>
            {examples.map((item, i) => (
              <figure key={item.src} className="v2-print">
                <Image
                  src={item.src}
                  alt={altFor(item.alt, lang)}
                  width={900}
                  height={575}
                  sizes="(max-width: 767px) 72vw, 320px"
                  loading="lazy"
                />
                <figcaption>{v.captions[i]}</figcaption>
              </figure>
            ))}
            {gallery.map((item) => (
              <figure key={item.src} className="v2-print">
                <Image
                  src={item.src}
                  alt={altFor(item.alt, lang)}
                  width={800}
                  height={1000}
                  sizes="(max-width: 767px) 62vw, 250px"
                  loading="lazy"
                />
              </figure>
            ))}
          </div>
          <p className="v2-hint v2-wrap">{v.examplesHint}</p>

          <div className="v2-wrap v2-reviews-head">
            <h2 className="v2-h2">{v.reviewsTitle}</h2>
            <p className="v2-lead">{v.reviewsLead}</p>
          </div>
          <div className="v2-rail v2-rail-reviews" tabIndex={0} role="region" aria-label={v.reviewsTitle}>
            {reviewShots.map((shot) => (
              <figure key={shot.src} className="v2-review">
                <Image
                  src={shot.src}
                  alt={altFor(shot.alt, lang)}
                  width={1200}
                  height={1800}
                  sizes="(max-width: 767px) 72vw, 280px"
                  loading="lazy"
                />
              </figure>
            ))}
          </div>
          <div className="v2-wrap v2-center">
            <button type="button" className="hero-cta-btn v2-cta" onClick={() => scrollToBuilder("reviews")}>
              <span>{ctaLabel}</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        {/* 5. Предложение: комплект, цена, второй брелок, срок, доставка, оплата */}
        <section id="price" className="offer-sec v2-section">
          <div className="wrap">
            <SectionLabel n={5} text={v.offerLabel} />
            <div className="offer-grid">
              <div className="offer-card">
                <h2 className="offer-eyebrow">{v.offerTitle}</h2>
                <div className="offer-price">{t.priceBig}</div>
                <p className="offer-second">{t.secondOffer}</p>
                <div className="offer-divider" />
                <ul className="offer-list offer-include">
                  {v.includeItems.map((item) => (
                    <li key={item}>
                      <span className="offer-icon" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                          <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <div>
                        <span>{item}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="offer-side">
                <h2 className="offer-risk-title">{lang === "ru" ? "Если не подойдёт" : "Dacă nu se potrivește"}</h2>
                <p className="v2-risk">{t.riskItem3Text}</p>
                <button type="button" className="offer-cta" onClick={() => scrollToBuilder("price")}>
                  <span>{t.offerCta}</span>
                  <span aria-hidden="true">→</span>
                </button>
                <div className="offer-chat-links">
                  <a
                    className="offer-tg offer-tg-btn"
                    href={telegramLink(lang === "ru" ? "Здравствуйте! Хочу такой брелок." : "Bună ziua! Vreau un astfel de breloc.")}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track("telegram_click", { source: "price_secondary" })}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M21 4L3 11l6 2 2 6 3-4 5 4 2-15z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    </svg>
                    {lang === "ru" ? "Написать в Telegram" : "Scrie pe Telegram"}
                  </a>
                  <a
                    className="offer-tg offer-tg-btn"
                    href={INSTAGRAM_DM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track("instagram_click", { source: "price_secondary" })}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="17" cy="7" r="1.2" fill="currentColor" />
                    </svg>
                    {lang === "ru" ? "Написать в Instagram" : "Scrie pe Instagram"}
                  </a>
                </div>
              </div>
            </div>

            <div className="offer-bottom">
              <div className="offer-delivery">
                <h2 className="offer-delivery-title">{t.deliveryTitle}</h2>
                <div className="offer-delivery-row">
                  <div>
                    <div className="offer-delivery-head">
                      <strong>{t.deliveryPickup}</strong>
                      <em>{t.deliveryPickupPrice}</em>
                    </div>
                    <p>{t.deliveryPickupPlace}</p>
                  </div>
                </div>
                <div className="offer-delivery-row">
                  <div>
                    <div className="offer-delivery-head">
                      <strong>{t.deliveryPosta}</strong>
                      <em>{t.deliveryPostaPrice}</em>
                    </div>
                    <p>{t.deliveryPostaNote}</p>
                  </div>
                </div>
                <div className="offer-delivery-row">
                  <div>
                    <div className="offer-delivery-head">
                      <strong>{t.deliveryNova}</strong>
                      <em>{t.deliveryNovaPrice}</em>
                    </div>
                    <p>{t.deliveryNovaNote}</p>
                  </div>
                </div>
                <p className="v2-pay">
                  <strong>{t.riskItem2Title}.</strong> {t.riskItem2Text}
                </p>
                <p className="v2-pay">
                  {lang === "ru"
                    ? "Изготовление 1–2 рабочих дня. Срочно — в день заказа, если договориться заранее."
                    : "Producție 1–2 zile lucrătoare. Urgent — în ziua comenzii, dacă ne înțelegem din timp."}
                </p>
              </div>

              <div className="offer-facts">
                <p className="offer-facts-title">{t.factsTitle}</p>
                <p>{t.factsText1}</p>
                <p>{t.factsText2}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Вопросы */}
        <section className="faq v2-section" id="faq">
          <div className="wrap-narrow">
            <SectionLabel n={6} text={v.faqLabel} />
            <h2>{t.faqTitle}</h2>
            {v.faqPick.map((idx) => {
              const item = faq[idx];
              const isOpen = openFaq.includes(idx);
              return (
                <div className="faq-item" key={item.q}>
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq((cur) => (cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx]))}
                  >
                    <span>{item.q}</span>
                    <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                  </button>
                  <div className="faq-a" hidden={!isOpen}>
                    <p>{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 7. Финал */}
        <section className="final final-cta v2-final" id="order">
          <div className="wrap final-cta-grid">
            <div className="final-cta-copy">
              <p className="final-eyebrow">Кадр 07 / 07 · {v.finalLabel}</p>
              <h2 className="final-title">{v.finalTitle}</h2>
              <p className="final-lead">{v.finalLead}</p>
            </div>
            <div className="final-cta-actions">
              <button type="button" className="hero-cta-btn final-btn" onClick={() => scrollToBuilder("final")}>
                <span>{ctaLabel}</span>
                <span aria-hidden="true">→</span>
              </button>
              <p className="final-phone">
                <span>{v.finalWrite}</span>
                <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" onClick={() => track("telegram_click", { source: "final" })}>
                  Telegram
                </a>
                <a href={INSTAGRAM_DM_URL} target="_blank" rel="noopener noreferrer" onClick={() => track("instagram_click", { source: "final" })}>
                  Instagram
                </a>
                <a href={`tel:${TELEGRAM_PHONE}`}>{TELEGRAM_PHONE_DISPLAY}</a>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          <div className="foot-logo">
            PHOTO<span>BRELOK</span>
          </div>
          <ul className="foot-list">
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <span>{v.address}</span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span>{t.footerHours}</span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M3 7l9 7 9-7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </li>
          </ul>
          <div className="foot-social">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
              Telegram
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          </div>
          <p className="foot-note">{v.madeIn}</p>
          <p className="foot-trademark">{t.trademarkNote}</p>
          <div className="foot-legal">
            <Link href="/privacy">{legalCopy[lang].nav.privacy}</Link>
            <span aria-hidden="true">·</span>
            <Link href="/cookies">{legalCopy[lang].nav.cookies}</Link>
          </div>
        </div>
      </footer>

      <aside className={`mobile-cta ${mobileCtaHidden || heroCtaVisible || !cookiesDecided ? "hidden" : ""}`} aria-label={v.quick}>
        <div className="mobile-cta-price">
          <div className="mobile-cta-amount">{t.priceChip}</div>
          <div className="mobile-cta-note">
            {photoCount >= 6
              ? lang === "ru"
                ? `Фото: ${photoCount} · макет бесплатно`
                : `Poze: ${photoCount} · machetă gratuită`
              : photoCount > 0
                ? lang === "ru"
                  ? `Добавьте ещё ${6 - photoCount} фото`
                  : `Adaugă încă ${6 - photoCount} poze`
                : t.mobileCtaNote}
          </div>
        </div>
        <button
          type="button"
          className="hero-cta-btn mobile-cta-button"
          onClick={() => {
            if (photoCount >= 6) window.dispatchEvent(new CustomEvent("photobrelok_open_order"));
            else scrollToBuilder("sticky");
          }}
        >
          {photoCount >= 6 ? t.priceCta : photoCount > 0 ? t.mobileCtaMore : t.mobileCtaBtn}
        </button>
      </aside>
    </div>
  );
}
