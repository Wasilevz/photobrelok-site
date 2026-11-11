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
      return `🚚 Способ получения: Poșta Moldovei — 30 лей\n📮 Индекс: ${d.postalCode}\n🏘 ${d.city}, р-н ${d.district}${d.street ? `\n🏠 Улица: ${d.street}` : ""}`;
    case "novapost":
      return `🚚 Способ получения: Nova Poshta — 60 лей\n📦 Отделение №${d.branch}`;
    case "taxi":
      return `🚚 Способ получения: Такси по Кишинёву\n🏠 Адрес: ${d.address}`;
    case "pickup":
      return "🚚 Способ получения: Самовывоз — бесплатно\n📍 A. Bernardazzi 64, Кишинёв (09:00–23:00)";
    default:
      return "🚚 Способ получения: клиент уточнит после макета";
  }
}

// Строки блока доставки начинаются с этих эмодзи — по ним блок находится и заменяется.
const DELIVERY_PREFIXES = ["🚚", "📮", "🏘", "🏠", "📦", "📍"];

export function methodFromCaption(caption: string): DeliveryMethod {
  const line = caption.split("\n").find((l) => l.startsWith("🚚 Способ получения:")) || "";
  if (line.includes("Самовывоз")) return "pickup";
  if (line.includes("Poșta")) return "posta";
  if (line.includes("Nova Poshta")) return "novapost";
  if (line.includes("Такси")) return "taxi";
  return "later";
}

export function replaceDelivery(caption: string, deliveryBlock: string): string {
  const lines = caption.split("\n").filter((l) => !DELIVERY_PREFIXES.some((p) => l.startsWith(p)));
  const photosIdx = lines.findIndex((l) => l.startsWith("📸"));
  const at = photosIdx === -1 ? lines.length : photosIdx + 1;
  lines.splice(at, 0, ...deliveryBlock.split("\n"));
  return lines.join("\n");
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
