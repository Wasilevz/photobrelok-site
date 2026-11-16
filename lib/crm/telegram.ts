// Связь CRM с чатом производства: заказ лежит в теме своей стадии с кнопками следующего шага.
// Удаления сообщений — только при переносе между темами (копия с PDF остаётся) и при «Удалить заказ».
import { tg } from "../telegram-orders.ts";
import { buildCrmCaption } from "./caption.ts";
import { chatKeyboard, moveMessage, threadFor } from "./chat.ts";
import type { CrmOrder } from "./model.ts";
import { chatTopics } from "./topics.ts";
import { saveOrder } from "./db.ts";

const bot = () => process.env.TELEGRAM_BOT_USERNAME;
const NOT_MODIFIED = /message is not modified/i;
const OLD_MESSAGE_MS = 47 * 3600_000; // старше — Telegram, скорее всего, не даст удалить (лимит 48 часов)

/** Подпись и кнопки сообщения на месте. Ошибки Telegram не мешают работе CRM — только в лог. */
async function editInPlace(o: CrmOrder): Promise<void> {
  const caption = buildCrmCaption(o);
  try {
    await tg("editMessageCaption", {
      chat_id: o.tgChatId,
      message_id: o.tgMessageId,
      caption,
      reply_markup: { inline_keyboard: chatKeyboard(o, bot()) },
    });
    await saveOrder(o.code, { tg_caption: caption });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!NOT_MODIFIED.test(message)) console.error(`CRM ${o.code}: chat caption not updated: ${message}`);
  }
}

/**
 * Перенос заказа в тему его стадии (решение владельца) — без дублей: копия с тем же PDF в нужную тему, затем
 * старое сообщение удаляется. Если Telegram не дал удалить старое (оно старше 48 часов), копия убирается, а заказ
 * остаётся в прежнем сообщении — в нём обновляются стадия и кнопки. quiet — копия без звука (перенос, скорее
 * всего, не получится).
 */
async function relocateOrderMessage(o: CrmOrder, chatId: number, threadId: number, quiet: boolean): Promise<void> {
  const caption = buildCrmCaption(o);
  const moved = await moveMessage({
    copy: async () =>
      (
        await tg<{ message_id: number }>("copyMessage", {
          chat_id: chatId,
          from_chat_id: o.tgChatId,
          message_id: o.tgMessageId,
          message_thread_id: threadId,
          caption,
          reply_markup: { inline_keyboard: chatKeyboard(o, bot()) },
          ...(quiet ? { disable_notification: true } : {}),
        })
      ).message_id,
    deleteOld: () => tg("deleteMessage", { chat_id: o.tgChatId, message_id: o.tgMessageId }),
    deleteCopy: (messageId) => tg("deleteMessage", { chat_id: chatId, message_id: messageId }),
  });
  if (moved === null) return editInPlace(o);
  await saveOrder(o.code, { tg_chat_id: chatId, tg_message_id: moved, tg_thread_id: threadId, tg_caption: caption });
}

/**
 * Привести сообщение заказа в чате к данным CRM: если стадия требует другую тему — перенести, иначе обновить
 * подпись и кнопки. prev — заказ до изменения (по нему понимаем, в какой теме лежит старое сообщение).
 */
export async function syncChat(prev: CrmOrder | null, next: CrmOrder): Promise<void> {
  if (next.tgChatId === null || next.tgMessageId === null) return;
  const topics = await chatTopics().catch(() => null);
  if (!topics || next.tgChatId !== topics.chatId) return editInPlace(next);
  const target = threadFor(next, topics.threads);
  const current = next.tgThreadId ?? threadFor(prev ?? next, topics.threads);
  if (!target || target === current) return editInPlace(next);
  const quiet = Date.now() - Date.parse((prev ?? next).stageChangedAt) > OLD_MESSAGE_MS;
  return relocateOrderMessage(next, topics.chatId, target, quiet);
}

/**
 * Удаляет сообщение заказа из чата — только при полном удалении заказа кнопкой «Удалить заказ».
 * Сообщение старше 48 часов Telegram удалить не даёт: помечаем его «удалён» и убираем кнопки.
 */
export async function deleteOrderMessage(o: CrmOrder): Promise<"deleted" | "none" | "failed"> {
  if (o.tgChatId === null || o.tgMessageId === null) return "none";
  const message = { chat_id: o.tgChatId, message_id: o.tgMessageId };
  try {
    await tg("deleteMessage", message);
    return "deleted";
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (/message to delete not found/i.test(text)) return "deleted";
    console.error(`CRM ${o.code}: chat message not deleted: ${text}`);
    await tg("editMessageCaption", {
      ...message,
      caption: `🗑 Заказ #${o.code} удалён из CRM. Это сообщение можно удалить вручную.`,
      reply_markup: { inline_keyboard: [] },
    }).catch(() => {});
    return "failed";
  }
}
