// Общая логика Telegram-воркфлоу заказов: темы-стадии, подпись заказа, кнопки.
// Используется и формой заказа (app/api/order), и вебхуком бота (app/api/telegram-webhook).
import { createHmac, timingSafeEqual } from "node:crypto";
import { type DeliveryMethod, fieldsFromCaption, replaceDelivery, setFieldLines } from "./order-fields.ts";

export {
  type DeliveryDetails,
  type DeliveryMethod,
  buildDeliveryText,
  cleanText,
  methodFromCaption,
  replaceDelivery,
} from "./order-fields.ts";

export type Stage = "work" | "pickup" | "ship" | "done";

export type InlineButton = { text: string; callback_data: string };

export const METHOD_CODE: Record<DeliveryMethod, string> = {
  pickup: "p",
  posta: "s",
  novapost: "n",
  taxi: "t",
  later: "l",
};

export function methodFromCode(code: string): DeliveryMethod | null {
  const entry = (Object.entries(METHOD_CODE) as [DeliveryMethod, string][]).find(([, c]) => c === code);
  return entry ? entry[0] : null;
}

export function isDeliveryMethod(value: unknown): value is DeliveryMethod {
  return typeof value === "string" && value in METHOD_CODE;
}

/* ------------------------------ Конфигурация ------------------------------ */

export type TopicConfig = {
  chatId: string;
  threads: Record<Stage, number | undefined>;
  allowedUserIds: Set<string>;
};

function parseThread(value: string | undefined): number | undefined {
  const n = Number((value || "").trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** null — режим тем выключен (нет нужных переменных), заказы идут как раньше. */
export function getTopicConfig(): TopicConfig | null {
  const chatIds = (process.env.TELEGRAM_CHAT_ID || "").split(",").map((id) => id.trim()).filter(Boolean);
  const chatId = (process.env.TELEGRAM_TOPIC_CHAT_ID || chatIds[0] || "").trim();
  const threads: TopicConfig["threads"] = {
    work: parseThread(process.env.TELEGRAM_TOPIC_WORK),
    pickup: parseThread(process.env.TELEGRAM_TOPIC_PICKUP),
    ship: parseThread(process.env.TELEGRAM_TOPIC_SHIP),
    done: parseThread(process.env.TELEGRAM_TOPIC_DONE),
  };
  if (!chatId || !threads.work || !threads.pickup || !threads.ship || !threads.done) return null;
  const allowedUserIds = new Set(
    (process.env.TELEGRAM_ALLOWED_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean),
  );
  return { chatId, threads, allowedUserIds };
}

/** Куда слать служебные сообщения о заказе: те же чаты, что и у /api/order, плюс тема «В работе». */
export function getOrderRecipients(): { chatId: string; threadId?: number }[] {
  const topics = getTopicConfig();
  const ids = [
    ...new Set([
      ...(process.env.TELEGRAM_CHAT_ID || "").split(",").map((id) => id.trim()).filter(Boolean),
      ...(topics ? [topics.chatId] : []),
    ]),
  ];
  return ids.map((chatId) => ({
    chatId,
    threadId: topics && chatId === topics.chatId ? topics.threads.work : undefined,
  }));
}

export function stageOfThread(cfg: TopicConfig, threadId: number | undefined): Stage | null {
  if (threadId === undefined) return null;
  for (const stage of Object.keys(cfg.threads) as Stage[]) {
    if (cfg.threads[stage] === threadId) return stage;
  }
  return null;
}

/** Стадия «готов» зависит от способа получения. */
export function readyStage(method: DeliveryMethod): "pickup" | "ship" {
  return method === "pickup" ? "pickup" : "ship";
}

/* ------------------------------ Текст заказа ------------------------------ */

/** Заметки менеджера: свободный текст, убираем только управляющие символы. */
export function cleanNote(value: unknown, maxLength = 200): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

export function buildOrderCaption(o: {
  orderId: string;
  name: string;
  phone: string;
  langNote?: string;
  sourceLine?: string;
  deliveryBlock: string;
  urgent?: boolean;
  wantedDate?: string;
  shipBy?: string;
}): string {
  const base = `🔥 Новый заказ #${o.orderId}\n👤 Клиент: ${o.name}\n📞 Тел: ${o.phone}${o.langNote ?? ""}${o.sourceLine ? `\n${o.sourceLine}` : ""}`;
  const caption = replaceDelivery(base, o.deliveryBlock);
  if (!o.wantedDate && !o.urgent) return caption;
  // Срочность и дату ставит та же функция, что и правка в боте: вид подписи один.
  const fields = { ...fieldsFromCaption(caption, new Date()), urgent: !!o.urgent, wantedDate: o.wantedDate };
  return setFieldLines(caption, fields, o.shipBy);
}

const CAPTION_LIMIT = 1000; // у Telegram лимит 1024

export function appendLine(caption: string, line: string): string {
  const lines = [...caption.split("\n"), line];
  // Если подпись разрослась — сначала выкидываем самые старые строки истории.
  while (lines.join("\n").length > CAPTION_LIMIT) {
    const idx = lines.findIndex((l) => l.startsWith("🕒"));
    if (idx === -1) break;
    lines.splice(idx, 1);
  }
  return lines.join("\n").slice(0, CAPTION_LIMIT);
}

export function historyLine(label: string, date = new Date()): string {
  const stamp = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Chisinau",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `🕒 ${stamp.replace(",", "")} · ${label}`;
}

/* -------------------- Подписанная ссылка на сообщение заказа -------------------- */

// После оформления заказа сайт получает подписанный токен: id сообщений заказа и его подпись.
// По нему апселл дописывается в подпись самого заказа (и переезжает вместе с ним по темам),
// а подделать токен и править чужие сообщения бота нельзя.

export type UpsellRef = { chatId: string; messageId: number; threadId?: number };
export type UpsellPayload = { orderId: string; caption: string; refs: UpsellRef[] };

function signingKey(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_BOT_TOKEN || "";
}

function sign(body: string): string {
  return createHmac("sha256", signingKey()).update(body).digest("base64url");
}

export function createUpsellToken(payload: UpsellPayload): string | null {
  if (!signingKey()) return null;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readUpsellToken(token: unknown, orderId: string): UpsellPayload | null {
  if (typeof token !== "string" || token.length > 6000 || !signingKey()) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as UpsellPayload;
    if (payload.orderId !== orderId || !Array.isArray(payload.refs) || typeof payload.caption !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

const UPSELL_MARK = "ВТОРОЙ БРЕЛОК";
const UPSELL_TITLE_TAG = " — ⚠️ 2 БРЕЛКА";
const UPSELL_RULE = "━━━━━━━━━━━━━━━";

/** Есть ли в подписи блок про второй брелок (поддерживаем и прежний вид с «АПСЕЛЛ»). */
export function hasUpsell(caption: string): boolean {
  return caption.includes(UPSELL_MARK) || caption.includes("АПСЕЛЛ");
}

/**
 * Делает второй брелок заметным с первого взгляда: тег в заголовке (виден и в списке чатов)
 * и короткий блок сразу под ним. Блок едет вместе с заказом по темам, потому что бот
 * переносит подпись целиком. Повторный вызов подпись не меняет.
 */
export function withUpsell(caption: string): string {
  if (hasUpsell(caption)) return caption;
  const [first, ...rest] = caption.split("\n");
  const block = [
    UPSELL_RULE,
    `⚠️ ${UPSELL_MARK}`,
    "Положите в заказ 2 штуки",
    "Стоимость: 400 лей плюс доставка",
    UPSELL_RULE,
  ];
  return [`${first}${UPSELL_TITLE_TAG}`, ...block, ...rest].join("\n").slice(0, 1000);
}

/** Убирает блок и тег второго брелка (клиент нажал случайно). Остальная подпись не меняется. */
export function withoutUpsell(caption: string): string {
  const lines = caption.split("\n");
  if (lines[0]) lines[0] = lines[0].replace(UPSELL_TITLE_TAG, "");
  const start = lines.findIndex((l) => l.startsWith("━"));
  const end = start === -1 ? -1 : lines.findIndex((l, i) => i > start && l.startsWith("━"));
  if (start !== -1 && end !== -1) lines.splice(start, end - start + 1);
  return lines.join("\n");
}

/* ------------------------------- Bot API ---------------------------------- */

export async function tg<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!json?.ok) throw new Error(json?.description || `Telegram ${method} failed: ${res.status}`);
  return json.result as T;
}
