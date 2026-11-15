// Обработка апдейтов Telegram: кнопки под заказами и ответы-правки.
import { after } from "next/server";
import {
  type Stage,
  type TopicConfig,
  appendLine,
  cleanNote,
  hasUpsell,
  getTopicConfig,
  historyLine,
  keyboard,
  methodFromCaption,
  readyStage,
  stageOfThread,
  tg,
  upsellConfirmMenu,
  withoutUpsell,
} from "@/lib/telegram-orders";
import { addDays, isPostMethod, parseManagerDate } from "@/lib/delivery-dates";
import { applyTemplate, fieldsFromCaption, fieldsTemplate, setFieldLines } from "@/lib/order-fields";

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
      reply_markup: { inline_keyboard: keyboard(stage, cfg, hasUpsell(caption)) },
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
    reply_markup: { inline_keyboard: keyboard(to, cfg, hasUpsell(caption)) },
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
    case "back":
      if (stage === "pickup" || stage === "ship") {
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
  e: "Скопируйте блок (нажмите на него), исправьте нужное и отправьте ответом. Строки без изменений можно удалить.",
  note: "Ответьте на это сообщение текстом заметки к заказу.",
};

// Состояние хранится прямо в сообщении-запросе: подпись заказа + ссылка на него. База не нужна.
// Для правки под пояснением идёт шаблон с текущими данными заказа (без пустых строк — их ждёт PROMPT_RE).
function promptHeader(kind: string, caption: string): { header: string; template?: string } {
  if (kind !== "e") return { header: PROMPTS[kind] };
  const template = fieldsTemplate(fieldsFromCaption(caption, new Date()));
  return { header: `${PROMPTS.e}\n${template}`, template };
}

const PROMPT_RE = /^[^\n]+(?:\n[^\n]+)*\n\n([\s\S]*)\n\n#ref:(\d+):(\w+)$/;

async function askDetails(msg: TgMessage, kind: string, userId: number) {
  const caption = msg.caption ?? "";
  const { header, template } = promptHeader(kind, caption);
  const text = `👉 ${header}\n\n${caption}\n\n#ref:${msg.message_id}:${kind}`;
  // force_reply + упоминание нажавшего: поле ответа открывается само, и только у него.
  // Шаблон — блоком кода: в Telegram он копируется одним нажатием.
  const entities: Record<string, unknown>[] = [{ type: "text_mention", offset: 0, length: 2, user: { id: userId } }];
  if (template) entities.push({ type: "pre", offset: text.indexOf(template), length: template.length });
  const sent = await tg<{ message_id: number }>("sendMessage", {
    chat_id: msg.chat.id,
    ...(msg.message_thread_id ? { message_thread_id: msg.message_thread_id } : {}),
    text,
    entities,
    reply_markup: {
      force_reply: true,
      selective: true,
      input_field_placeholder: kind === "note" ? "Текст заметки" : "Вставьте исправленный блок",
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

  const [action] = cb.data.split(":");
  const caption = msg.caption ?? "";

  switch (action) {
    case "rdy":
    case "fin":
    case "back":
      await transition(cfg, msg, stage, action);
      return;
    case "ed":
    case "edm": // кнопка «✏️ Доставка» в заказах, пришедших до появления «✏️ Изменить»
      await askDetails(msg, "e", cb.from.id);
      return;
    case "esc":
      await safe(
        tg("editMessageReplyMarkup", {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          reply_markup: { inline_keyboard: keyboard(stage, cfg, hasUpsell(caption)) },
        }),
      );
      return;
    case "nt":
      await askDetails(msg, "note", cb.from.id);
      return;
    case "ups":
      if (!hasUpsell(caption)) return "Второго брелка в заказе нет";
      await tg("editMessageReplyMarkup", {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        reply_markup: { inline_keyboard: upsellConfirmMenu() },
      });
      return;
    case "upsx": {
      if (!hasUpsell(caption)) {
        await editInPlace(cfg, msg.chat.id, msg.message_id, caption, stage);
        return "Второго брелка уже нет";
      }
      const next = appendLine(withoutUpsell(caption), historyLine("↩️ Второй брелок убран"));
      await editInPlace(cfg, msg.chat.id, msg.message_id, next, stage);
      return "Второй брелок убран из заказа";
    }
    default:
      throw new UserError("Неизвестное действие");
  }
}

/* ----------------------------- Ответ на запрос деталей ---------------------------- */

/** «Отправить до» для почты: прежнее, если дата не менялась, иначе за 3 дня до желаемой. */
function nextShipBy(caption: string, wantedDate: string | undefined, dateChanged: boolean): string | undefined {
  if (!wantedDate) return undefined;
  if (!dateChanged) {
    const old = caption.split("\n").find((l) => l.startsWith("📅"))?.match(/отправить до:\s*\S+\s+(\d{1,2}\.\d{1,2})/);
    if (old) return parseManagerDate(old[1], new Date()) ?? undefined;
  }
  return addDays(wantedDate, -3);
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
    } else if (kind === "e") {
      const now = new Date();
      const result = applyTemplate(msg.text, fieldsFromCaption(caption, now), now);
      if (!result.ok) throw new UserError(result.error);
      if (result.changed.length === 0) throw new UserError("Ничего не изменилось");
      const { fields, changed } = result;
      const ship = isPostMethod(fields.method)
        ? nextShipBy(caption, fields.wantedDate, changed.includes("дата") || changed.includes("способ"))
        : undefined;
      next = appendLine(setFieldLines(caption, fields, ship), historyLine(`✏️ Изменено: ${changed.join(", ")}`));
      deliveryChanged = changed.includes("способ");
    } else {
      return;
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
