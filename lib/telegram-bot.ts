// Обработка апдейтов Telegram. Чат производства: под заказом кнопка следующего шага — стадия меняется
// в CRM, заказ переезжает в тему стадии (lib/crm/telegram.ts). Старые кнопки заменяются на новые.
import { after } from "next/server";
import { tg } from "@/lib/telegram-orders";
import { parseAllowed } from "@/lib/crm/auth";
import { chatKeyboard, parseStageCallback } from "@/lib/crm/chat";
import { getOrder } from "@/lib/crm/db";
import { stageLabel } from "@/lib/crm/model";
import { changeStageFromChat } from "@/lib/crm/stage";

type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
type TgChat = { id: number; type?: string };
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

const NOT_MODIFIED = /message is not modified/i;
const ALREADY_GONE = /message to delete not found|message can't be deleted/i;
const ID_TTL_MS = 20_000;

async function safe(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof Error) || !(NOT_MODIFIED.test(error.message) || ALREADY_GONE.test(error.message))) {
      console.error("Telegram call failed:", error instanceof Error ? error.message : error);
    }
  }
}

/** Удаляет служебный ответ бота (не заказ!) через delayMs, чтобы не захламлять чат. */
function deleteLater(chatId: number, messageId: number, delayMs: number) {
  try {
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await safe(tg("deleteMessage", { chat_id: chatId, message_id: messageId }));
    });
  } catch {
    // вне запроса after недоступен — служебное сообщение просто останется
  }
}

function answer(cb: NonNullable<TgUpdate["callback_query"]>, text: string, alert = false) {
  return safe(tg("answerCallbackQuery", { callback_query_id: cb.id, text, show_alert: alert }));
}

/** Кто может нажимать кнопки заказов: CRM_ALLOWED_USER_IDS и TELEGRAM_ALLOWED_USER_IDS; оба пусты — все в группе. */
function mayPress(userId: number): boolean {
  const ids = new Set([...parseAllowed(process.env.CRM_ALLOWED_USER_IDS), ...parseAllowed(process.env.TELEGRAM_ALLOWED_USER_IDS)]);
  return ids.size === 0 || ids.has(userId);
}

/** Кнопка стадии под заказом: «В производство», «Готов…», «Завершить», «Назад». */
async function handleStageButton(cb: NonNullable<TgUpdate["callback_query"]>, code: string, stage: Parameters<typeof changeStageFromChat>[1]) {
  if (!mayPress(cb.from.id)) return answer(cb, "Нет доступа к заказам", true);
  const name = [cb.from.first_name, cb.from.last_name].filter(Boolean).join(" ") || cb.from.username || String(cb.from.id);
  try {
    const result = await changeStageFromChat(code, stage, { id: cb.from.id, name });
    if (!result.ok) return answer(cb, result.error, true);
    return answer(cb, `#${code} → ${stageLabel(result.order.stage, result.order.method)}`);
  } catch (error) {
    console.error(`Chat stage ${code}:`, error instanceof Error ? error.message : error);
    return answer(cb, "Не получилось, попробуйте ещё раз", true);
  }
}

/** Старые кнопки (до чата по стадиям): ставим под сообщение новые кнопки и просим нажать ещё раз. */
async function handleLegacyButton(cb: NonNullable<TgUpdate["callback_query"]>) {
  const msg = cb.message;
  const code = (msg?.caption ?? msg?.text ?? "").match(/#([A-Z0-9]{6})/)?.[1];
  const order = code ? await getOrder(code).catch(() => null) : null;
  if (msg && order && !order.deletedAt) {
    await safe(
      tg("editMessageReplyMarkup", {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        reply_markup: { inline_keyboard: chatKeyboard(order, process.env.TELEGRAM_BOT_USERNAME) },
      }),
    );
    return answer(cb, "Кнопки обновлены — нажмите нужную ещё раз", true);
  }
  return answer(cb, "Этого заказа нет в CRM", true);
}

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) {
    const cb = update.callback_query;
    const stage = parseStageCallback(cb.data);
    if (stage) await handleStageButton(cb, stage.code, stage.stage);
    else await handleLegacyButton(cb);
    return;
  }

  const msg = update.message;
  if (!msg?.text) return;

  // /id — ID группы, темы и пользователя (для настройки тем и доступа к CRM).
  if (/^\/id(@\w+)?(\s|$)/.test(msg.text)) {
    try {
      const info = await tg<{ message_id: number }>("sendMessage", {
        chat_id: msg.chat.id,
        ...(msg.message_thread_id ? { message_thread_id: msg.message_thread_id } : {}),
        text: `Ваш user id: ${msg.from?.id ?? "—"}\nchat_id: ${msg.chat.id}\nthread_id: ${msg.message_thread_id ?? "— (общая тема)"}`,
      });
      // В личке ответ оставляем (там его и ищут), в группе — убираем через 20 секунд.
      if (msg.chat.type !== "private") deleteLater(msg.chat.id, info.message_id, ID_TTL_MS);
    } catch (error) {
      console.error("/id failed:", error instanceof Error ? error.message : error);
    }
  }
}
