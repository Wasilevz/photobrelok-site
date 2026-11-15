// Обработка апдейтов Telegram. Заказы ведутся в CRM (Mini App), поэтому бот в чате
// ничего не переносит и не удаляет: кнопки под прошлыми заказами только отправляют в CRM.
// Запрет владельца: сообщения с заказами и PDF не удаляются никогда (см. lib/no-deletes.test.ts).
import { after } from "next/server";
import { tg } from "@/lib/telegram-orders";
import { crmKeyboard } from "@/lib/crm/links";

type TgUser = { id: number; is_bot?: boolean };
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

/** Старые кнопки под заказами (Готов, Выдан, Назад, Изменить, Заметка…): только подсказка и кнопка CRM. */
async function handleLegacyButton(cb: NonNullable<TgUpdate["callback_query"]>) {
  const msg = cb.message;
  const code = (msg?.caption ?? msg?.text ?? "").match(/#([A-Z0-9]{6})/)?.[1];
  if (msg && code) {
    const markup = crmKeyboard(code);
    if (markup.length > 0) {
      await safe(
        tg("editMessageReplyMarkup", {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          reply_markup: { inline_keyboard: markup },
        }),
      );
    }
  }
  await safe(
    tg("answerCallbackQuery", {
      callback_query_id: cb.id,
      text: "Заказы теперь ведутся в CRM — откройте заказ кнопкой «📋 Открыть в CRM» под сообщением",
      show_alert: true,
    }),
  );
}

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) {
    await handleLegacyButton(update.callback_query);
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
