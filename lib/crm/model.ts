// Модель заказа CRM: стадии и колонки доски, цена, сортировка, проверка правок менеджера.
// Чистые функции без сети — их используют API, интерфейс и тесты.

import type { DeliveryMethod, OrderFields } from "../order-fields.ts";
import { earliestDate, isDay, isPostMethod, chisinauToday } from "../delivery-dates.ts";
import { formatMdPhone, normalizeMdPhone } from "../phone.ts";

export type Stage = "new" | "production" | "ready" | "done";
export const STAGES: Stage[] = ["new", "production", "ready", "done"];

/** Колонки доски: «Готов» разделён по способу доставки (самовывоз/такси — выдача, почта — отправка). */
export type Column = "new" | "production" | "pickup" | "ship" | "done";
export const COLUMNS: Column[] = ["new", "production", "pickup", "ship", "done"];

const COLUMN_LABEL: Record<Column, string> = {
  new: "🆕 Новые",
  production: "🛠 В производстве",
  pickup: "🏪 Готов к выдаче",
  ship: "📦 Готов к отправке",
  done: "✅ Завершён",
};

export const METHODS: DeliveryMethod[] = ["pickup", "posta", "novapost", "taxi", "later"];

export type CrmOrder = {
  code: string;
  createdAt: string;
  stage: Stage;
  stageChangedAt: string;
  name: string;
  phone: string;
  wantedDate: string | null;
  urgent: boolean;
  method: DeliveryMethod;
  postalCode: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  branch: string | null;
  address: string | null;
  qty: number;
  price: number | null;
  lang: "ru" | "ro";
  source: string | null;
  pdfPath: string | null;
  tgChatId: number | null;
  tgMessageId: number | null;
  tgCaption: string | null;
  flags: string[];
  commentsCount: number;
  /** Подарочных коробок: null — по правилу (orderBoxes), число — вписано вручную. */
  boxes: number | null;
  /** Прочие расходы по заказу (лей), например другой тип брелка. */
  extraCost: number | null;
  /** Оплачен заранее на карту: при выдаче/отправке деньги не брать, наложенный платёж не оформлять. */
  paid: boolean;
  /** Убран из CRM (тестовый/ошибочный): строка, PDF и сообщение в чате остаются. null — активный. */
  deletedAt: string | null;
};

export function columnOf(o: Pick<CrmOrder, "stage" | "method">): Column {
  if (o.stage === "ready") return isPostMethod(o.method) ? "ship" : "pickup";
  return o.stage;
}

export function stageOfColumn(c: Column): Stage {
  return c === "pickup" || c === "ship" ? "ready" : c;
}

export function columnLabel(c: Column): string {
  return COLUMN_LABEL[c];
}

export function stageLabel(stage: Stage, method: DeliveryMethod): string {
  return columnLabel(columnOf({ stage, method }));
}

export function nextStage(s: Stage): Stage | null {
  return STAGES[STAGES.indexOf(s) + 1] ?? null;
}

export function prevStage(s: Stage): Stage | null {
  const i = STAGES.indexOf(s);
  return i > 0 ? STAGES[i - 1] : null;
}

export const BASE_PRICE = 250;
export const EXTRA_PRICE = 150;
export const URGENT_PRICE = 100;

export function orderPrice(o: Pick<CrmOrder, "qty" | "urgent" | "price">): number {
  if (o.price !== null) return o.price;
  return BASE_PRICE + EXTRA_PRICE * (o.qty - 1) + (o.urgent ? URGENT_PRICE : 0);
}

/** Доставка Poșta Moldovei: всегда добавляется к сумме, которую платит клиент. */
export const POST_DELIVERY_FEE = 30;

/** Сколько платит клиент: цена заказа + 30 лей за доставку почтой Молдовы. */
export function amountDue(o: Pick<CrmOrder, "qty" | "urgent" | "price" | "method">): number {
  return orderPrice(o) + (o.method === "posta" ? POST_DELIVERY_FEE : 0);
}

/** Себестоимость единиц, задаётся в отчётах (crm_settings). */
export type Costs = { keychain: number; box: number };
export const ZERO_COSTS: Costs = { keychain: 0, box: 0 };

/**
 * Подарочные коробки по правилу: 1 брелок — 1 коробка, 2 одинаковых — вместе в одну, 3 и больше — каждому своя.
 * Иначе (3 одинаковых «каждый как подарок», 2 разных) — число вписывают вручную.
 */
export function orderBoxes(o: Pick<CrmOrder, "qty" | "boxes">): { count: number; auto: boolean } {
  if (o.boxes !== null) return { count: o.boxes, auto: false };
  return { count: o.qty === 2 ? 1 : o.qty, auto: true };
}

export function orderCost(o: Pick<CrmOrder, "qty" | "boxes" | "extraCost">, c: Costs): number {
  return o.qty * c.keychain + orderBoxes(o).count * c.box + (o.extraCost ?? 0);
}

/** Срочные → ближайшая дата получения (без даты — ниже) → кто раньше пришёл. */
export function sortOrders(list: CrmOrder[]): CrmOrder[] {
  return [...list].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    if (a.wantedDate !== b.wantedDate) {
      if (a.wantedDate === null) return 1;
      if (b.wantedDate === null) return -1;
      return a.wantedDate < b.wantedDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

export type OrderPatch = Partial<
  Pick<
    CrmOrder,
    "name" | "phone" | "wantedDate" | "urgent" | "method" | "postalCode" | "city" | "district" | "street" | "branch" | "address" | "qty" | "price" | "stage" | "boxes" | "extraCost" | "paid"
  >
>;

const PATCH_KEYS: (keyof OrderPatch)[] = [
  "name", "phone", "wantedDate", "urgent", "method", "postalCode", "city", "district", "street", "branch", "address", "qty", "price", "stage", "boxes", "extraCost", "paid",
];
const TEXT_LIMIT: Partial<Record<keyof OrderPatch, number>> = {
  postalCode: 20, city: 80, district: 80, street: 100, branch: 40, address: 150,
};
const DELIVERY_KEYS: (keyof OrderPatch)[] = ["method", "postalCode", "city", "district", "street", "branch", "address", "urgent"];

type PatchResult = { ok: true; next: CrmOrder; changed: (keyof OrderPatch)[]; warnings: string[] } | { ok: false; error: string };

function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return v || null;
}

export function applyPatch(current: CrmOrder, patch: OrderPatch, now: Date): PatchResult {
  const next: CrmOrder = { ...current };
  const fail = (error: string): PatchResult => ({ ok: false, error });

  for (const key of PATCH_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    switch (key) {
      case "name": {
        const name = cleanLine(value, 60);
        if (!name) return fail("Имя не может быть пустым");
        next.name = name;
        break;
      }
      case "phone": {
        const check = normalizeMdPhone(typeof value === "string" ? value : "");
        if (!check.ok) return fail("Проверьте номер телефона");
        next.phone = formatMdPhone(check.digits);
        break;
      }
      case "wantedDate":
        if (value === null || value === "") next.wantedDate = null;
        else if (isDay(value)) next.wantedDate = value;
        else return fail("Неверная дата");
        break;
      case "urgent":
        next.urgent = value === true;
        break;
      case "paid":
        next.paid = value === true;
        break;
      case "method":
        if (!METHODS.includes(value as DeliveryMethod)) return fail("Неизвестный способ получения");
        next.method = value as DeliveryMethod;
        break;
      case "qty":
        if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 20) return fail("Количество — от 1 до 20");
        next.qty = value as number;
        break;
      case "price":
        if (value === null) next.price = null;
        else if (!Number.isInteger(value)) return fail("Цена — целое число");
        else if ((value as number) < 0) return fail("Цена не может быть отрицательной");
        else next.price = value as number;
        break;
      case "boxes":
        if (value === null) next.boxes = null;
        else if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 40) return fail("Коробок — от 0 до 40");
        else next.boxes = value as number;
        break;
      case "extraCost":
        if (value === null) next.extraCost = null;
        else if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100000) return fail("Расходы — целое число лей");
        else next.extraCost = value as number;
        break;
      case "stage":
        if (!STAGES.includes(value as Stage)) return fail("Неизвестная стадия");
        next.stage = value as Stage;
        break;
      default:
        next[key] = cleanLine(value, TEXT_LIMIT[key] ?? 100);
    }
  }

  // Поля других способов не храним: при смене способа они бы «всплывали» снова.
  if ("method" in patch) {
    if (next.method !== "posta") next.postalCode = next.city = next.district = next.street = null;
    if (next.method !== "novapost") next.branch = null;
    if (next.method !== "taxi") next.address = null;
  }

  // Обязательные поля способа проверяем, только когда правят доставку: правка имени у старого
  // заказа с неполным адресом не должна блокироваться.
  if (DELIVERY_KEYS.some((k) => k in patch)) {
    if (next.urgent && isPostMethod(next.method)) return fail("Срочно — только самовывоз или такси");
    if (next.method === "posta" && (!next.postalCode || !next.city || !next.district)) {
      return fail("Для почты нужны: индекс, город, район");
    }
    if (next.method === "novapost" && !next.branch) return fail("Для Nova Poshta нужен номер отделения");
    if (next.method === "taxi" && !next.address) return fail("Для такси нужен адрес");
  }

  const warnings: string[] = [];
  if ("wantedDate" in patch && next.wantedDate && !next.urgent) {
    if (isPostMethod(next.method) && next.wantedDate < earliestDate(next.method, now)) {
      warnings.push("Дата раньше ближайшей для почты");
    } else if (next.wantedDate < chisinauToday(now)) {
      warnings.push("Дата уже прошла");
    }
  }

  const changed = PATCH_KEYS.filter((k) => next[k] !== current[k]);
  if (next.stage !== current.stage) next.stageChangedAt = now.toISOString();
  return { ok: true, next, changed, warnings };
}

/** Поля для пересборки подписи в чате (lib/order-fields.ts → setFieldLines). */
export function toFields(o: CrmOrder): OrderFields {
  const f: OrderFields = { name: o.name, phone: o.phone, urgent: o.urgent, method: o.method };
  if (o.wantedDate) f.wantedDate = o.wantedDate;
  for (const key of ["postalCode", "city", "district", "street", "branch", "address"] as const) {
    const value = o[key];
    if (value) f[key] = value;
  }
  return f;
}

const COLUMN_MAP: [keyof CrmOrder, string][] = [
  ["code", "code"], ["createdAt", "created_at"], ["stage", "stage"], ["stageChangedAt", "stage_changed_at"],
  ["name", "name"], ["phone", "phone"], ["wantedDate", "wanted_date"], ["urgent", "urgent"], ["method", "method"],
  ["postalCode", "postal_code"], ["city", "city"], ["district", "district"], ["street", "street"], ["branch", "branch"],
  ["address", "address"], ["qty", "qty"], ["price", "price"], ["lang", "lang"], ["source", "source"], ["pdfPath", "pdf_path"],
  ["tgChatId", "tg_chat_id"], ["tgMessageId", "tg_message_id"], ["tgCaption", "tg_caption"], ["flags", "flags"],
  ["boxes", "boxes"], ["extraCost", "extra_cost"], ["paid", "paid"], ["deletedAt", "deleted_at"],
];

export function rowToOrder(row: Record<string, unknown>): CrmOrder {
  const o = {} as Record<string, unknown>;
  for (const [camel, snake] of COLUMN_MAP) o[camel] = row[snake] ?? null;
  o.urgent = o.urgent === true;
  o.paid = o.paid === true;
  o.qty = typeof o.qty === "number" ? o.qty : 1;
  o.flags = Array.isArray(o.flags) ? o.flags : [];
  o.lang = o.lang === "ro" ? "ro" : "ru";
  o.tgChatId = o.tgChatId === null ? null : Number(o.tgChatId);
  o.commentsCount = typeof row.comments_count === "number" ? row.comments_count : 0;
  return o as CrmOrder;
}

export function orderToRow(o: Partial<CrmOrder>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [camel, snake] of COLUMN_MAP) {
    if (camel in o) row[snake] = o[camel];
  }
  return row;
}
