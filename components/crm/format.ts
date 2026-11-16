import type { DeliveryMethod } from "@/lib/order-fields";
import { formatDay } from "@/lib/delivery-dates";

export const METHOD_LABEL: Record<DeliveryMethod, string> = {
  pickup: "🏪 Самовывоз",
  posta: "📮 Poșta Moldovei",
  novapost: "📦 Nova Poshta",
  taxi: "🚕 Такси",
  later: "⏳ Способ не выбран",
};

export function dateLabel(day: string | null): string {
  return day ? formatDay(day, "ru") : "дата не указана";
}

const WHEN = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Chisinau",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function whenLabel(iso: string): string {
  return WHEN.format(new Date(iso)).replace(",", "");
}

/** Ссылка на сообщение заказа в группе (t.me/c/…): там лежит PDF у заказов, перенесённых из чата. */
export function chatMessageUrl(o: { tgChatId: number | null; tgMessageId: number | null }): string | null {
  if (o.tgChatId === null || o.tgMessageId === null || !String(o.tgChatId).startsWith("-100")) return null;
  return `https://t.me/c/${String(o.tgChatId).slice(4)}/${o.tgMessageId}`;
}
