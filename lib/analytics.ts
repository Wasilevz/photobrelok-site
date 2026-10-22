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
  | "order_api_success";

type Payload = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function track(event: AnalyticsEvent, payload: Payload = {}) {
  if (typeof window === "undefined") return;
  const data = { event, ...payload, ts: Date.now() };
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(data);
  }
}
