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
