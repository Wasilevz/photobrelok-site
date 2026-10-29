export type AnalyticsEvent =
  | "hero_view"
  | "view_hero"
  | "click_cta"
  | "select_occasion"
  | "add_photo"
  | "quality_warning"
  | "reach_min_photos"
  | "submit_start"
  | "submit_success"
  | "submit_error"
  | "hero_cta"
  | "builder_start"
  | "photos_uploaded"
  | "photos_edited"
  | "preview_view"
  | "checkout_start"
  | "telegram_click"
  | "order_submit"
  | "order_api_success"
  | "video_play"
  | "video_mute"
  | "video_unmute";

type Payload = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
  }
}

// соответствие событий сайта стандартным событиям Meta Pixel
const META_EVENTS: Partial<Record<AnalyticsEvent, string>> = {
  hero_view: "ViewContent",
  preview_view: "ViewContent",
  add_photo: "AddToCart",
  checkout_start: "InitiateCheckout",
  telegram_click: "Contact",
  order_submit: "Lead",
};

const PRODUCT = { content_name: "photobrelok", currency: "MDL", value: 250 };

function trackMeta(event: AnalyticsEvent, payload: Payload) {
  const fbq = window.fbq;
  if (!fbq) return;
  const params = { ...PRODUCT, ...payload };
  if (event === "order_api_success") {
    // заказ размещён (оплата при получении) — главная конверсия
    fbq("track", "Lead", params);
    fbq("track", "Purchase", params);
    return;
  }
  const name = META_EVENTS[event];
  if (name) fbq("track", name, params);
}

export function track(event: AnalyticsEvent, payload: Payload = {}) {
  if (typeof window === "undefined") return;
  const data = { event, ...payload, ts: Date.now() };
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(data);
  }
  trackMeta(event, payload);
}
