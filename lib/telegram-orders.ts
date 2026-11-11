import { createHmac, timingSafeEqual } from "node:crypto";
// Общая логика Telegram-воркфлоу заказов: темы-стадии, подпись заказа, кнопки.
// Используется и формой заказа (app/api/order), и вебхуком бота (app/api/telegram-webhook).

export type DeliveryMethod = "pickup" | "posta" | "novapost" | "taxi" | "later";
export type Stage = "work" | "pickup" | "ship" | "done" | "cancel";

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
    cancel: parseThread(process.env.TELEGRAM_TOPIC_CANCEL),
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

export function cleanText(value: unknown, maxLength = 100): string {
  return typeof value === "string"
    ? value.replace(/[^\p{L}\p{N}\s\-.,/#@+]/gu, "").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

/** Заметки менеджера: свободный текст, убираем только управляющие символы. */
export function cleanNote(value: unknown, maxLength = 200): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

export type DeliveryDetails = {
  postalCode?: string;
  city?: string;
  district?: string;
  street?: string;
  branch?: string;
  address?: string;
};

export function buildDeliveryText(method: DeliveryMethod, d: DeliveryDetails = {}): string {
  switch (method) {
    case "posta":
      // Порядок адреса: улица, район, индекс, город; способ получения идёт последним (см. replaceDelivery)
      return `${d.street ? `🏠 Улица: ${d.street}\n` : ""}🏘 Район: ${d.district}\n📮 Индекс: ${d.postalCode}\n🏙 Город: ${d.city}\n🚚 Способ получения: Poșta Moldovei — 30 лей`;
    case "novapost":
      return `🚚 Способ получения: Nova Poshta — 60 лей\n📦 Отделение №${d.branch}`;
    case "taxi":
      return `🚚 Способ получения: Такси по Кишинёву\n🏠 Адрес: ${d.address}`;
    case "pickup":
      return "🚚 Способ получения: Самовывоз — бесплатно\n📍 A. Bernardazzi 64, Кишинёв (12:00–21:00)";
    default:
      return "🚚 Способ получения: клиент уточнит после макета";
  }
}

// Строки блока доставки начинаются с этих эмодзи — по ним блок находится и заменяется.
const DELIVERY_PREFIXES = ["🚚", "📮", "🏘", "🏙", "🏠", "📦", "📍"];

export function methodFromCaption(caption: string): DeliveryMethod {
  const line = caption.split("\n").find((l) => l.startsWith("🚚 Способ получения:")) || "";
  if (line.includes("Самовывоз")) return "pickup";
  if (line.includes("Poșta")) return "posta";
  if (line.includes("Nova Poshta")) return "novapost";
  if (line.includes("Такси")) return "taxi";
  return "later";
}

// Строки адреса для почты: стоят сразу под именем клиента, до телефона.
const ADDRESS_PREFIXES = ["🏘", "🏠 Улица:", "🏙", "📮"];

/**
 * Собирает блок доставки в подписи заказа в таком порядке:
 *   🔥 заказ → 👤 клиент → (почта: улица, район, индекс, город) → 📞 телефон →
 *   🚚 способ получения и его детали (внизу, чтобы бросалось в глаза) → заметки и история.
 * Вызывается и при создании заказа, и когда менеджер меняет доставку в боте.
 */
export function replaceDelivery(caption: string, deliveryBlock: string): string {
  // Строку «📸 Фотографий» больше не показываем: убираем и из старых подписей при правке
  const lines = caption
    .split("\n")
    .filter((l) => !DELIVERY_PREFIXES.some((p) => l.startsWith(p)) && !l.startsWith("📸"));
  const blockLines = deliveryBlock.split("\n");
  const top = blockLines.filter((l) => ADDRESS_PREFIXES.some((p) => l.startsWith(p)));
  const bottom = blockLines.filter((l) => !top.includes(l));

  // адрес: сразу после строки клиента (а если её нет — после заголовка)
  const clientIdx = lines.findIndex((l) => l.startsWith("👤"));
  lines.splice(clientIdx === -1 ? 1 : clientIdx + 1, 0, ...top);

  // способ получения: перед заметками менеджера и историей, иначе в самом конце
  const tailIdx = lines.findIndex((l) => l.startsWith("📝") || l.startsWith("🕒"));
  lines.splice(tailIdx === -1 ? lines.length : tailIdx, 0, ...bottom);
  return lines.join("\n");
}

export function buildOrderCaption(o: {
  orderId: string;
  name: string;
  phone: string;
  langNote?: string;
  deliveryBlock: string;
}): string {
  const base = `🔥 Новый заказ #${o.orderId}\n👤 Клиент: ${o.name}\n📞 Тел: ${o.phone}${o.langNote ?? ""}`;
  return replaceDelivery(base, o.deliveryBlock);
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

const UPSELL_MARK = "АПСЕЛЛ";

/**
 * Делает апселл заметным с первого взгляда: тег в заголовке (виден и в списке чатов)
 * и яркий блок сразу под ним. Блок едет вместе с заказом по темам, потому что бот
 * переносит подпись целиком. Повторный вызов подпись не меняет.
 */
export function withUpsell(caption: string): string {
  if (caption.includes(UPSELL_MARK)) return caption;
  const [first, ...rest] = caption.split("\n");
  const block = [
    "━━━━━━━━━━━━━━━",
    "⚠️⚠️ АПСЕЛЛ: ВТОРОЙ БРЕЛОК! ⚠️⚠️",
    "➕ Положите в заказ 2 шт. одинаковых брелка",
    "💰 Брелки: 250 + 150 (−40%) = 400 лей, плюс доставка",
    "━━━━━━━━━━━━━━━",
  ];
  return [`${first} — ⚠️ 2 БРЕЛКА`, ...block, ...rest].join("\n").slice(0, 1000);
}

/* --------------------------------- Кнопки --------------------------------- */

export function keyboard(stage: Stage, cfg: TopicConfig): InlineButton[][] {
  const edit: InlineButton = { text: "✏️ Доставка", callback_data: "edm" };
  const note: InlineButton = { text: "📝 Заметка", callback_data: "nt" };
  const cancel: InlineButton[] = cfg.threads.cancel ? [{ text: "❌ Отмена", callback_data: "can" }] : [];

  switch (stage) {
    case "work":
      return [[{ text: "✅ Готов", callback_data: "rdy" }], [edit, note, ...cancel]];
    case "pickup":
    case "ship":
      return [
        [{ text: stage === "pickup" ? "🤝 Выдан" : "🚚 Отправлен", callback_data: "fin" }],
        [{ text: "↩️ Назад", callback_data: "back" }, edit],
        [note, ...cancel],
      ];
    case "done":
      return [[{ text: "↩️ Назад", callback_data: "back" }, note]];
    case "cancel":
      return [[{ text: "↩️ Вернуть в работу", callback_data: "back" }]];
  }
}

export function deliveryMenu(): InlineButton[][] {
  return [
    [{ text: "🏪 Самовывоз", callback_data: `set:${METHOD_CODE.pickup}` }],
    [{ text: "📮 Poșta Moldovei", callback_data: `set:${METHOD_CODE.posta}` }],
    [{ text: "📦 Nova Poshta", callback_data: `set:${METHOD_CODE.novapost}` }],
    [{ text: "🚕 Такси по Кишинёву", callback_data: `set:${METHOD_CODE.taxi}` }],
    [{ text: "⏳ Клиент уточнит", callback_data: `set:${METHOD_CODE.later}` }],
    [{ text: "⬅️ Отмена", callback_data: "esc" }],
  ];
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
