import { META_PIXEL_ID } from "@/lib/meta";
import { readConsent } from "@/lib/consent";

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
  | "video_pause"
  | "video_resume"
  | "video_unmute";

type MetaEventIds = { lead?: string; purchase?: string };
type Payload = Record<
  string,
  string | number | boolean | null | undefined | MetaEventIds
>;

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

/** id события для дедупликации пикселя и Conversions API */
export function metaEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function trackMeta(event: AnalyticsEvent, payload: Payload) {
  // Явная проверка согласия: пока пользователь не принял маркетинг,
  // ни событий, ни контактов в Meta не уходит.
  if (!readConsent()?.marketing) return;

  const fbq = window.fbq;
  if (!fbq) return;

  const { metaEventIds, name, phone, orderId, ...rest } = payload as Payload & {
    metaEventIds?: { lead?: string; purchase?: string };
    name?: string;
    phone?: string;
    orderId?: string;
  };
  const params: Record<string, unknown> = { ...PRODUCT, ...rest };
  if (orderId) params.content_ids = [String(orderId)];

  if (event === "order_api_success") {
    // продвинутое сопоставление: передаём контакт клиента, fbq хеширует сам
    // (external_id сюда не отдаём — его хеширует сервер в Conversions API)
    const userData: Record<string, string> = {};
    if (phone) userData.ph = String(phone);
    if (name) {
      const [fn, ...lnParts] = String(name).trim().split(/\s+/);
      if (fn) userData.fn = fn;
      if (lnParts.length) userData.ln = lnParts.join(" ");
    }
    if (Object.keys(userData).length) fbq("init", META_PIXEL_ID, userData);

    // заказ размещён (оплата при получении) — главная конверсия;
    // eventID совпадает с серверным CAPI-событием, Meta дедуплицирует
    fbq("track", "Lead", params, { eventID: metaEventIds?.lead || metaEventId() });
    fbq("track", "Purchase", params, { eventID: metaEventIds?.purchase || metaEventId() });
    return;
  }

  const metaName = META_EVENTS[event];
  if (metaName) fbq("track", metaName, params, { eventID: metaEventId() });
}

export function track(event: AnalyticsEvent, payload: Payload = {}) {
  if (typeof window === "undefined") return;
  // В dataLayer не кладём имя, телефон и ID событий Meta, и только с согласием на аналитику
  const { name: _name, phone: _phone, metaEventIds: _ids, ...safe } = payload as Payload & {
    name?: string;
    phone?: string;
    metaEventIds?: unknown;
  };
  void _name; void _phone; void _ids;
  if (readConsent()?.analytics) {
    // Создаём dataLayer сами: раньше события молча терялись, пока нет GTM.
    // Подключённый позже менеджер тегов подхватит уже накопленную очередь.
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...safe, ts: Date.now() });
  }
  trackMeta(event, payload);
}
