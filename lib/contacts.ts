export const TELEGRAM_URL = "https://t.me/+37378238455";
export const TELEGRAM_PHONE = "+37378238455";
export const TELEGRAM_PHONE_DISPLAY = "078 238 455";
export const EMAIL = "fotobrelokmd@gmail.com";
export const ADDRESS = "ул. Alexander Bernardazzi, 64, Кишинёв";
export const PRICE_MDL = 250;
export const MIN_PHOTOS = 6;
export const MAX_PHOTOS = 10;
export const LEAD_TIME = "1–2 дня";
export const WORK_HOURS = "09:00–23:00";

/** Messengers — same number. Instagram handle: confirm with owner if it differs. */
export const WHATSAPP_URL = "https://wa.me/37378238455";
export const VIBER_URL = "viber://chat?number=%2B37378238455";
export const INSTAGRAM_URL = "https://www.instagram.com/fotobrelok.md/";

export const DELIVERY_OPTIONS = {
  pickup: { label: "pickup", price: 0, days: null as string | null },
  posta: { label: "posta", price: 30, days: "2–4" },
  novapost: { label: "novapost", price: 60, days: "2–3" },
} as const;

export function telegramLink(text: string) {
  return `${TELEGRAM_URL}?text=${encodeURIComponent(text)}`;
}

export function formatDelivery(delivery: {
  method: string;
  postalCode?: string;
  street?: string;
  city?: string;
  district?: string;
  novaPostBranch?: string;
}): string {
  if (delivery.method === "posta") {
    const parts = [
      delivery.postalCode,
      delivery.city,
      delivery.district,
      delivery.street,
    ].filter(Boolean);
    return `Poșta Moldovei (30 лей): ${parts.join(", ")}`;
  }
  if (delivery.method === "novapost") {
    return `Nova Poshta (60 лей), отделение №${delivery.novaPostBranch}`;
  }
  return "Самовывоз — A. Bernardazzi 64, Кишинёв (бесплатно)";
}
