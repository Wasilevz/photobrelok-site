"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import PhotoConstructor from "@/components/PhotoConstructor";
import { useLanguage } from "@/context/LanguageContext";
import {
  ADDRESS,
  EMAIL,
  TELEGRAM_PHONE,
  TELEGRAM_PHONE_DISPLAY,
  TELEGRAM_URL,
  INSTAGRAM_URL,
  telegramLink,
} from "@/lib/contacts";
import { track } from "@/lib/analytics";
import { landingCopy, faqCopy, occasionCopy } from "@/lib/landing-copy";
import { UrgencyBanner } from "@/components/Urgency";
import { useOccasion } from "@/lib/occasion-store";

function HeroProductVideo({ lang }: { lang: "ru" | "ro" }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      video.removeAttribute("autoplay");
      video.pause();
      return;
    }
    video.play().then(() => track("video_play")).catch(() => {
      /* autoplay blocked — user can tap play */
    });
  }, []);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted) video.play().catch(() => {});
    track(video.muted ? "video_mute" : "video_unmute");
  };

  if (failed) {
    return (
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
    );
  }

  return (
    <div className="hero-video-wrap">
      <video
        ref={videoRef}
        className="hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/media/hero-product.jpg"
        onError={() => setFailed(true)}
        aria-label={
          lang === "ru"
            ? "Видео: как выглядит брелок-катушка с вашими фото"
            : "Video: cum arată brelocul-casetă cu pozele tale"
        }
      >
        <source src="/media/hero-product.mp4" type="video/mp4" />
      </video>
      <button
        type="button"
        className="hero-video-mute"
        onClick={toggleMute}
        aria-label={
          muted
            ? lang === "ru"
              ? "Включить звук"
              : "Pornește sunetul"
            : lang === "ru"
              ? "Выключить звук"
              : "Oprește sunetul"
        }
      >
        {muted ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 5L6 9H3v6h3l5 4V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 5L6 9H3v6h3l5 4V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <span className="hero-video-badge">{lang === "ru" ? "Живой вид" : "În direct"}</span>
    </div>
  );
}

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

export default function Landing() {
  const { lang, setLang } = useLanguage();
  const { occasion, setOccasion } = useOccasion();
  const t = landingCopy[lang];
  const faq = faqCopy[lang];
  const occasions = occasionCopy[lang];
  const [mobileCtaHidden, setMobileCtaHidden] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  // Open delivery + timing FAQs by default so key terms are visible without a tap
  const [openFaq, setOpenFaq] = useState<number[]>([2, 6, 7]);
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

    const onSlots = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === "number") setPhotoCount(detail);
    };
    window.addEventListener("photobrelok_slots", onSlots);
    return () => {
      io.disconnect();
      window.removeEventListener("photobrelok_slots", onSlots);
    };
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
        <div className="wrap hd-bar">
          <a className="logo" href="#top">
            PHOTO<span>BRELOK</span>
          </a>
          <nav className="hd-actions" aria-label={lang === "ru" ? "Язык" : "Limbă"}>
            <button
              type="button"
              className="lang-btn"
              data-testid="lang-switch"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLang(lang === "ru" ? "ro" : "ru");
              }}
              aria-label={lang === "ru" ? "Переключить на румынский" : "Comută pe rusă"}
            >
              {lang === "ru" ? "Румынский" : "Русский"}
            </button>
          </nav>
        </div>
      </header>
      <UrgencyBanner />

      <main id="top">
        <section className="hero">
          <div className="wrap">
            <div className="hero-card hero-unified">
              <div className="hero-unified-copy">
                <p className="eyebrow">
                  <span className="eyebrow-dot" aria-hidden="true" />
                  {t.eyebrow}
                </p>
                <h1>{t.heroTitle}</h1>
                <p className="lead">{t.heroLead}</p>
                <div className="hero-price-block">
                  <div className="hero-price">{t.heroPrice}</div>
                  <p className="hero-price-note">{t.heroPriceNote}</p>
                </div>
                <div className="offer-divider" />
                <ul className="offer-list offer-list-plain hero-feats">
                  <li>
                    <span className="offer-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div>
                      <strong>{t.heroFeat1Title}</strong>
                      <span>{t.heroFeat1Text}</span>
                    </div>
                  </li>
                  <li>
                    <span className="offer-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div>
                      <strong>{t.heroFeat2Title}</strong>
                      <span>{t.heroFeat2Text}</span>
                    </div>
                  </li>
                  <li>
                    <span className="offer-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <rect x="2.5" y="6" width="19" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M2.5 10h19" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M6 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                    <div>
                      <strong>{t.heroFeat3Title}</strong>
                      <span>{t.heroFeat3Text}</span>
                    </div>
                  </li>
                </ul>
                <button type="button" className="hero-cta-btn" onClick={scrollToBuilder}>
                  <span>{photoCount > 0 ? t.priceCta : t.heroCta}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
              <div className="hero-unified-media">
                <HeroProductVideo lang={lang} />
              </div>
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

<section id="reviews" className="reviews-sec">
          <div className="wrap">
            <h2>{t.reviewsTitle}</h2>
            <p className="lead">{t.reviewsLead}</p>

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

        <section id="price" className="offer-sec">
          <div className="wrap">
            <div className="offer-grid">
              {/* Yellow offer card */}
              <div className="offer-card">
                <p className="offer-eyebrow">{t.priceTitle}</p>
                <div className="offer-price">{t.priceBig}</div>
                <p className="offer-tagline">{t.priceText}</p>
                <div className="offer-divider" />
                <ul className="offer-list">
                  <li>
                    <span className="offer-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div>
                      <strong>{t.offerItem1Title}</strong>
                      <span>{t.offerItem1Text}</span>
                    </div>
                  </li>
                  <li>
                    <span className="offer-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M4 10h16v10H4V10z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        <path d="M2.5 7h19v3h-19V7zM12 7v13" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        <path d="M12 7c-2-3-5-3-5 0M12 7c2-3 5-3 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                    <div>
                      <strong>{t.offerItem2Title}</strong>
                      <span>{t.offerItem2Text}</span>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Risk-free side */}
              <div className="offer-side">
                <h2 className="offer-risk-title">{t.riskTitle}</h2>
                <ul className="offer-list offer-list-plain">
                  <li>
                    <span className="offer-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" stroke="currentColor" strokeWidth="1.8" />
                        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </span>
                    <div>
                      <strong>{t.riskItem1Title}</strong>
                      <span>{t.riskItem1Text}</span>
                    </div>
                  </li>
                  <li>
                    <span className="offer-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <rect x="2.5" y="6" width="19" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M2.5 10h19" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M6 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                    <div>
                      <strong>{t.riskItem2Title}</strong>
                      <span>{t.riskItem2Text}</span>
                    </div>
                  </li>
                  <li>
                    <span className="offer-icon" aria-hidden="true">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M4 8h10a4 4 0 010 8H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        <path d="M7 5L4 8l3 3M17 19l3-3-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div>
                      <strong>{t.riskItem3Title}</strong>
                      <span>{t.riskItem3Text}</span>
                    </div>
                  </li>
                </ul>

                <button
                  type="button"
                  className="offer-cta"
                  onClick={() => {
                    track("hero_cta");
                    track("builder_start");
                    const el = document.getElementById("constructor") || document.getElementById("builder");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <span>{t.priceCta}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>

            <a
              className="offer-tg"
              href={telegramLink(
                lang === "ru"
                  ? "Здравствуйте! Хочу такой брелок."
                  : "Bună ziua! Vreau un astfel de breloc."
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("telegram_click", { source: "price_secondary" })}
            >
              {lang === "ru" ? "Написать в Telegram" : "Scrie pe Telegram"}
            </a>

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
            </div>

            <div className="offer-facts">
              <p className="offer-facts-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M8.5 12l2.5 2.5L15.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t.factsTitle}
              </p>
              <p>{t.factsText1}</p>
              <p>{t.factsText2}</p>
            </div>
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
              const isOpen = openFaq.includes(i);
              return (
                <div className="faq-item" key={item.q}>
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenFaq((current) =>
                        current.includes(i)
                          ? current.filter((index) => index !== i)
                          : [...current, i]
                      )
                    }
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

        <section className="final final-cta" id="order">
          <div className="wrap final-cta-grid">
            <div className="final-cta-copy">
              <p className="final-eyebrow">{t.finalEyebrow}</p>
              <h2 className="final-title">{t.finalTitle}</h2>
              <p className="final-lead">{t.finalLead}</p>
            </div>
            <div className="final-cta-actions">
              <button type="button" className="hero-cta-btn final-btn" onClick={scrollToBuilder}>
                <span>{t.finalTg}</span>
                <span aria-hidden="true">→</span>
              </button>
              <p className="final-phone">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 006 6l1.5-2 4 1.5v3a2 2 0 01-2 2A15.5 15.5 0 014.5 5.5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
                <span>{t.finalCallLabel}</span>
                <a href={`tel:${TELEGRAM_PHONE}`}>{TELEGRAM_PHONE_DISPLAY}</a>
              </p>
              <p className="final-note">{t.finalNote}</p>
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
              <span>{ADDRESS} · {lang === "ru" ? "Кишинёв" : "Chișinău"}</span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span>{t.footerHours}</span>
            </li>
          </ul>
          <p className="foot-note">{t.footerNote}</p>
          <div className="foot-divider" />
          <ul className="foot-list">
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M3 7l9 7 9-7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 006 6l1.5-2 4 1.5v3a2 2 0 01-2 2A15.5 15.5 0 014.5 5.5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              <a href={`tel:${TELEGRAM_PHONE}`}>{TELEGRAM_PHONE_DISPLAY}</a>
            </li>
          </ul>
          <div className="foot-social">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 4L3 11l6 2 2 6 3-4 5 4 2-15z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              Telegram
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="17" cy="7" r="1.2" fill="currentColor" />
              </svg>
              Instagram
            </a>
          </div>
        </div>
      </footer>

      <div className={`mobile-cta ${mobileCtaHidden ? "hidden" : ""}`}>
        <div className="mobile-cta-price">
          <div className="mobile-cta-amount">{t.priceChip}</div>
          <div className="mobile-cta-note">
            {photoCount > 0
              ? (lang === "ru" ? `Фото: ${photoCount} · макет бесплатно` : `Poze: ${photoCount} · machetă gratuită`)
              : t.mobileCtaNote}
          </div>
        </div>
        <button type="button" className="hero-cta-btn mobile-cta-button" onClick={scrollToBuilder}>
          {photoCount > 0 ? t.priceCta : t.mobileCtaBtn}
        </button>
      </div>
    </div>
  );
}
