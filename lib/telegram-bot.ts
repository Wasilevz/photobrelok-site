// Обработка апдейтов Telegram: кнопки под заказами и ответы-правки.
import { after } from "next/server";
import {
  type DeliveryDetails,
  type DeliveryMethod,
  type Stage,
  type TopicConfig,
  appendLine,
  buildDeliveryText,
  cleanNote,
  cleanText,
  deliveryMenu,
  getTopicConfig,
  historyLine,
  keyboard,
  methodFromCaption,
  methodFromCode,
  readyStage,
  replaceDelivery,
  stageOfThread,
  tg,
} from "@/lib/telegram-orders";

type TgUser = { id: number; is_bot?: boolean };
type TgChat = { id: number };
export type TgMessage = {
  message_id: number;
  message_thread_id?: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  caption?: string;
  reply_to_message?: TgMessage;
};
export type TgUpdate = {
  message?: TgMessage;
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage };
};

class UserError extends Error {}

const NOT_MODIFIED = /message is not modified/i;
const ALREADY_GONE = /message to delete not found|message can't be deleted/i;

async function safe(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof Error) || !(NOT_MODIFIED.test(error.message) || ALREADY_GONE.test(error.message))) {
      console.error("Telegram call failed:", error instanceof Error ? error.message : error);
    }
  }
}

/** Удаляет служебное сообщение через delayMs, чтобы не захламлять чат. Если окружение не даёт отложить — просто остаётся. */
function deleteLater(chatId: number, messageId: number, delayMs: number) {
  try {
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await safe(tg("deleteMessage", { chat_id: chatId, message_id: messageId }));
    });
  } catch {
    // вне запроса after недоступен
  }
}

const WARNING_TTL_MS = 8_000;
const PROMPT_TTL_MS = 4 * 60_000;
const ID_TTL_MS = 20_000;

function isAllowed(cfg: TopicConfig, user: TgUser | undefined, chatId: number): boolean {
  if (String(chatId) !== cfg.chatId) return false;
  if (cfg.allowedUserIds.size === 0) return true;
  return !!user && cfg.allowedUserIds.has(String(user.id));
}

/* ----------------------------- Действия с заказом ----------------------------- */

async function editInPlace(cfg: TopicConfig, chatId: number, messageId: number, caption: string, stage: Stage) {
  try {
    await tg("editMessageCaption", {
      chat_id: chatId,
      message_id: messageId,
      caption,
      reply_markup: { inline_keyboard: keyboard(stage, cfg) },
    });
  } catch (error) {
    if (error instanceof Error && NOT_MODIFIED.test(error.message)) return;
    throw error;
  }
}

/** Telegram не умеет переносить сообщения между темами: копируем в нужную тему и удаляем оригинал. */
async function moveOrder(cfg: TopicConfig, chatId: number, messageId: number, caption: string, to: Stage) {
  const thread = cfg.threads[to];
  if (!thread) throw new UserError("Тема для этой стадии не настроена");
  await tg("copyMessage", {
    chat_id: chatId,
    from_chat_id: chatId,
    message_id: messageId,
    message_thread_id: thread,
    caption,
    reply_markup: { inline_keyboard: keyboard(to, cfg) },
  });
  try {
    await tg("deleteMessage", { chat_id: chatId, message_id: messageId });
  } catch {
    // Нет права удалять: гасим кнопки у оригинала, чтобы не плодить дубли.
    await safe(tg("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }));
    throw new UserError("Заказ скопирован, но старое сообщение не удалено. Дайте боту право удалять сообщения.");
  }
}

/** Применяет новую подпись; если способ получения изменился на другой тип — переносит между «выдача/отправка». */
async function applyCaption(
  cfg: TopicConfig,
  chatId: number,
  messageId: number,
  threadId: number | undefined,
  caption: string,
  deliveryChanged: boolean,
) {
  const stage = stageOfThread(cfg, threadId);
  if (!stage) throw new UserError("Эта тема не настроена в боте");
  if (deliveryChanged && (stage === "pickup" || stage === "ship")) {
    const target = readyStage(methodFromCaption(caption));
    if (target !== stage) {
      await moveOrder(cfg, chatId, messageId, caption, target);
      return;
    }
  }
  await editInPlace(cfg, chatId, messageId, caption, stage);
}

async function transition(cfg: TopicConfig, msg: TgMessage, stage: Stage, action: string) {
  const caption = msg.caption ?? "";
  const method = methodFromCaption(caption);
  let to: Stage;
  let label: string;

  switch (action) {
    case "rdy":
      if (stage !== "work") throw new UserError("Заказ уже не в работе");
      to = readyStage(method);
      label = method === "pickup" ? "✅ Готов к выдаче" : "✅ Готов к отправке";
      break;
    case "fin":
      if (stage !== "pickup" && stage !== "ship") throw new UserError("Заказ ещё не готов");
      to = "done";
      label = stage === "pickup" ? "🤝 Выдан" : "🚚 Отправлен";
      break;
    case "can":
      if (stage === "done" || stage === "cancel") throw new UserError("Заказ уже завершён");
      to = "cancel";
      label = "❌ Отменён";
      break;
    case "back":
      if (stage === "pickup" || stage === "ship" || stage === "cancel") {
        to = "work";
        label = "↩️ Возврат в работу";
      } else if (stage === "done") {
        to = readyStage(method);
        label = "↩️ Возврат из завершённых";
      } else {
        throw new UserError("Назад некуда");
      }
      break;
    default:
      throw new UserError("Неизвестное действие");
  }

  await moveOrder(cfg, msg.chat.id, msg.message_id, appendLine(caption, historyLine(label)), to);
}

/* ------------------------------ Запрос деталей ------------------------------ */

const PROMPTS: Record<string, string> = {
  s: "Ответьте на это сообщение: индекс, город/село, район[, улица]\nНапример: MD-2001, Кишинёв, Кишинёв, Колумна 5",
  n: "Ответьте на это сообщение номером отделения Nova Poshta.\nНапример: 12",
  t: "Ответьте на это сообщение адресом доставки по Кишинёву.\nНапример: ул. Колумна 5, кв. 12",
  note: "Ответьте на это сообщение текстом заметки к заказу.",
};

// Состояние хранится прямо в сообщении-запросе: подпись заказа + ссылка на него. База не нужна.
function buildPrompt(kind: string, caption: string, orderMessageId: number): string {
  return `${PROMPTS[kind]}\n\n${caption}\n\n#ref:${orderMessageId}:${kind}`;
}

const PROMPT_RE = /^[^\n]+(?:\n[^\n]+)*\n\n([\s\S]*)\n\n#ref:(\d+):(\w+)$/;

async function askDetails(msg: TgMessage, kind: string, userId: number) {
  // force_reply + упоминание нажавшего: поле ответа открывается само, и только у него.
  const sent = await tg<{ message_id: number }>("sendMessage", {
    chat_id: msg.chat.id,
    ...(msg.message_thread_id ? { message_thread_id: msg.message_thread_id } : {}),
    text: `👉 ${buildPrompt(kind, msg.caption ?? "", msg.message_id)}`,
    entities: [{ type: "text_mention", offset: 0, length: 2, user: { id: userId } }],
    reply_markup: {
      force_reply: true,
      selective: true,
      input_field_placeholder: kind === "note" ? "Текст заметки" : "Введите данные",
    },
  });
  // Если на запрос так и не ответили — убираем его сами.
  deleteLater(msg.chat.id, sent.message_id, PROMPT_TTL_MS);
}

/* --------------------------------- Callback --------------------------------- */

async function handleCallback(cfg: TopicConfig, cb: NonNullable<TgUpdate["callback_query"]>): Promise<string | undefined> {
  const msg = cb.message;
  if (!msg || !cb.data) return;
  if (!isAllowed(cfg, cb.from, msg.chat.id)) return "Нет доступа";

  const stage = stageOfThread(cfg, msg.message_thread_id);
  if (!stage) throw new UserError("Эта тема не настроена в боте");

  const [action, arg] = cb.data.split(":");
  const caption = msg.caption ?? "";

  switch (action) {
    case "rdy":
    case "fin":
    case "can":
    case "back":
      await transition(cfg, msg, stage, action);
      return;
    case "edm":
      await tg("editMessageReplyMarkup", {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        reply_markup: { inline_keyboard: deliveryMenu() },
      });
      return;
    case "esc":
      await safe(
        tg("editMessageReplyMarkup", {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          reply_markup: { inline_keyboard: keyboard(stage, cfg) },
        }),
      );
      return;
    case "nt":
      await askDetails(msg, "note", cb.from.id);
      return;
    case "set": {
      const method = methodFromCode(arg || "");
      if (!method) throw new UserError("Неизвестный способ");
      // Закрываем меню в любом случае.
      await safe(
        tg("editMessageReplyMarkup", {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          reply_markup: { inline_keyboard: keyboard(stage, cfg) },
        }),
      );
      if (method === "posta" || method === "novapost" || method === "taxi") {
        await askDetails(msg, arg as string, cb.from.id);
        return;
      }
      const next = appendLine(
        replaceDelivery(caption, buildDeliveryText(method)),
        historyLine("✏️ Доставка изменена"),
      );
      await applyCaption(cfg, msg.chat.id, msg.message_id, msg.message_thread_id, next, true);
      return;
    }
    default:
      throw new UserError("Неизвестное действие");
  }
}

/* ----------------------------- Ответ на запрос деталей ---------------------------- */

function parseDetails(method: DeliveryMethod, raw: string): DeliveryDetails {
  if (method === "posta") {
    const parts = raw.split(/[,;\n]/).map((p) => cleanText(p, 80)).filter(Boolean);
    if (parts.length < 3) {
      throw new UserError("Нужно минимум три значения через запятую: индекс, город/село, район");
    }
    return { postalCode: parts[0].slice(0, 20), city: parts[1], district: parts[2], street: parts.slice(3).join(", ").slice(0, 100) };
  }
  if (method === "novapost") {
    const branch = cleanText(raw, 40);
    if (!branch) throw new UserError("Укажите номер отделения");
    return { branch };
  }
  const address = cleanText(raw, 150);
  if (!address) throw new UserError("Укажите адрес");
  return { address };
}

async function handleReply(cfg: TopicConfig, msg: TgMessage) {
  const prompt = msg.reply_to_message;
  if (!prompt?.from?.is_bot || !prompt.text || !msg.text) return;
  const match = prompt.text.match(PROMPT_RE);
  if (!match) return;
  if (!isAllowed(cfg, msg.from, msg.chat.id)) return;

  const [, caption, id, kind] = match;
  const orderMessageId = Number(id);
  const threadId = msg.message_thread_id ?? prompt.message_thread_id;

  try {
    let next: string;
    let deliveryChanged = false;
    if (kind === "note") {
      const note = cleanNote(msg.text);
      if (!note) throw new UserError("Заметка пустая");
      next = appendLine(caption, `📝 ${note}`);
    } else {
      const method = methodFromCode(kind);
      if (!method) return;
      next = appendLine(
        replaceDelivery(caption, buildDeliveryText(method, parseDetails(method, msg.text))),
        historyLine("✏️ Доставка изменена"),
      );
      deliveryChanged = true;
    }
    await applyCaption(cfg, msg.chat.id, orderMessageId, threadId, next, deliveryChanged);
    await safe(tg("deleteMessage", { chat_id: msg.chat.id, message_id: prompt.message_id }));
    await safe(tg("deleteMessage", { chat_id: msg.chat.id, message_id: msg.message_id }));
  } catch (error) {
    const text =
      error instanceof UserError
        ? error.message
        : "Не удалось обновить заказ. Возможно, он уже перемещён — нажмите кнопку под заказом заново.";
    if (!(error instanceof UserError)) console.error("Reply edit failed:", error);
    try {
      const warn = await tg<{ message_id: number }>("sendMessage", {
        chat_id: msg.chat.id,
        ...(threadId ? { message_thread_id: threadId } : {}),
        reply_parameters: { message_id: msg.message_id },
        text: `⚠️ ${text}`,
      });
      // Предупреждение и неверный ответ исчезают сами; запрос остаётся — можно ответить ещё раз.
      deleteLater(msg.chat.id, warn.message_id, WARNING_TTL_MS);
      deleteLater(msg.chat.id, msg.message_id, WARNING_TTL_MS);
    } catch (sendError) {
      console.error("Warning failed:", sendError instanceof Error ? sendError.message : sendError);
    }
  }
}

/* ---------------------------------- Вход ---------------------------------- */

export async function handleUpdate(update: TgUpdate): Promise<void> {
  const cb = update.callback_query;
  if (cb) {
    const cfg = getTopicConfig();
    let toast: string | undefined;
    try {
      if (!cfg) toast = "Темы не настроены";
      else toast = await handleCallback(cfg, cb);
    } catch (error) {
      toast = error instanceof UserError ? error.message : "Ошибка, попробуйте ещё раз";
      if (!(error instanceof UserError)) console.error("Callback failed:", error);
    }
    await safe(tg("answerCallbackQuery", { callback_query_id: cb.id, ...(toast ? { text: toast.slice(0, 200), show_alert: !!toast } : {}) }));
    return;
  }

  const msg = update.message;
  if (!msg?.text) return;

  // /id — помогает узнать ID группы и темы при настройке.
  if (/^\/id(@\w+)?(\s|$)/.test(msg.text)) {
    try {
      const info = await tg<{ message_id: number }>("sendMessage", {
        chat_id: msg.chat.id,
        ...(msg.message_thread_id ? { message_thread_id: msg.message_thread_id } : {}),
        text: `chat_id: ${msg.chat.id}\nthread_id: ${msg.message_thread_id ?? "— (общая тема)"}`,
      });
      deleteLater(msg.chat.id, info.message_id, ID_TTL_MS);
      deleteLater(msg.chat.id, msg.message_id, ID_TTL_MS);
    } catch (error) {
      console.error("/id failed:", error instanceof Error ? error.message : error);
    }
    return;
  }

  const cfg = getTopicConfig();
  if (cfg && msg.reply_to_message) await handleReply(cfg, msg);
}
