// Связь CRM с чатом производства: заказ лежит в теме своей стадии с кнопками следующего шага.
// Удаления сообщений — только при переносе между темами (копия с PDF остаётся) и при «Удалить заказ».
import { tg } from "../telegram-orders.ts";
import { buildCrmCaption } from "./caption.ts";
import { actualThread, chatKeyboard, moveMessage, threadFor } from "./chat.ts";
import { type CrmOrder, stageLabel } from "./model.ts";
import { chatTopics } from "./topics.ts";
import { saveOrder } from "./db.ts";

const bot = () => process.env.TELEGRAM_BOT_USERNAME;
const NOT_MODIFIED = /message is not modified/i;
const OLD_MESSAGE_MS = 47 * 3600_000; // старше — Telegram, скорее всего, не даст удалить (лимит 48 часов)

/** Подпись и кнопки сообщения на месте. Ошибки Telegram не мешают работе CRM — только в лог. Возвращает тему сообщения, если Telegram её сообщил. */
async function editInPlace(o: CrmOrder): Promise<number | null> {
  const caption = buildCrmCaption(o);
  try {
    const result = await tg("editMessageCaption", {
      chat_id: o.tgChatId,
      message_id: o.tgMessageId,
      caption,
      reply_markup: { inline_keyboard: chatKeyboard(o, bot()) },
    });
    const thread = actualThread(result);
    await saveOrder(o.code, { tg_caption: caption, ...(thread !== null && thread !== o.tgThreadId ? { tg_thread_id: thread } : {}) });
    return thread;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!NOT_MODIFIED.test(message)) console.error(`CRM ${o.code}: chat caption not updated: ${message}`);
    return null;
  }
}

/**
 * В какой теме на самом деле лежит сообщение заказа. Telegram сообщает это только в ответе на правку, поэтому подпись
 * на мгновение меняется (невидимый символ в конце) и тут же возвращается: либо переносом, либо editInPlace.
 * null — не удалось узнать.
 */
async function probeThread(o: CrmOrder): Promise<number | null> {
  try {
    const result = await tg("editMessageCaption", {
      chat_id: o.tgChatId,
      message_id: o.tgMessageId,
      caption: `${buildCrmCaption(o)}\u200b`.slice(0, 1024),
      reply_markup: { inline_keyboard: chatKeyboard(o, bot()) },
    });
    return actualThread(result);
  } catch (error) {
    console.error(`CRM ${o.code}: thread not detected:`, error instanceof Error ? error.message : error);
    return null;
  }
}

type Relocated = "moved" | "stuck" | "stayed";

/**
 * Перенос заказа в тему его стадии (решение владельца) — без дублей: копия с тем же PDF в нужную тему, затем
 * старое сообщение удаляется. Если Telegram не дал удалить старое, копия убирается, а заказ остаётся в прежнем
 * сообщении — в нём обновляются стадия и кнопки. quiet — копия без звука (перенос, скорее всего, не получится).
 * keepIfStuck — только для разовой починки чата: копия остаётся, старое сообщение помечается «перенесён».
 */
async function relocateOrderMessage(o: CrmOrder, chatId: number, threadId: number, quiet: boolean, keepIfStuck = false): Promise<Relocated> {
  const caption = buildCrmCaption(o);
  let stuck = false;
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
    ...(keepIfStuck
      ? {
          onStuck: async () => {
            stuck = true;
            await tg("editMessageCaption", {
              chat_id: o.tgChatId,
              message_id: o.tgMessageId,
              caption: `➡️ Заказ #${o.code} перенесён в тему «${stageLabel(o.stage, o.method)}». Это старое сообщение — удалите его вручную.`,
              reply_markup: { inline_keyboard: [] },
            });
          },
        }
      : {}),
  });
  if (moved === null) {
    await editInPlace(o);
    return "stayed";
  }
  await saveOrder(o.code, { tg_chat_id: chatId, tg_message_id: moved, tg_thread_id: threadId, tg_caption: caption });
  return stuck ? "stuck" : "moved";
}

/**
 * Привести сообщение заказа в чате к данным CRM: если стадия требует другую тему — перенести, иначе обновить
 * подпись и кнопки. prev — заказ до изменения (по нему понимаем, в какой теме лежит старое сообщение).
 */
export async function syncChat(prev: CrmOrder | null, next: CrmOrder): Promise<void> {
  if (next.tgChatId === null || next.tgMessageId === null) return;
  const topics = await chatTopics().catch(() => null);
  if (!topics || next.tgChatId !== topics.chatId) {
    await editInPlace(next);
    return;
  }
  const target = threadFor(next, topics.threads);
  if (!target) {
    await editInPlace(next);
    return;
  }
  // Старые заказы: тема сообщения не записана — узнаём, где оно лежит на самом деле, а не гадаем по стадии.
  const probed = next.tgThreadId === null ? await probeThread(next) : null;
  const current = next.tgThreadId ?? probed ?? threadFor(prev ?? next, topics.threads);
  if (target === current) {
    await editInPlace(next); // заодно убирает невидимый символ пробы; тему запоминает по ответу Telegram
    if (probed !== null) await saveOrder(next.code, { tg_thread_id: probed });
    return;
  }
  const quiet = Date.now() - Date.parse((prev ?? next).stageChangedAt) > OLD_MESSAGE_MS;
  await relocateOrderMessage(next, topics.chatId, target, quiet);
}

export type RepairResult = {
  checked: number;
  alreadyOk: number;
  moved: number;
  /** Не дали удалить старое сообщение: заказ уже в нужной теме, старое помечено — его удалить вручную. */
  stuck: { code: string; name: string; url: string | null }[];
  failed: number;
};

const PAUSE_MS = 2500; // лимит Telegram на сообщения в группе — не больше ~20 в минуту

/**
 * Разовая починка чата: приводит расположение заказов в чате к CRM. Тему каждого заказа узнаёт по ответу Telegram,
 * переносит только тех, кто лежит не в своей теме. Не удалось убрать старое сообщение — копия остаётся в нужной
 * теме, старое помечается (удалить вручную), заказ из списка «stuck» попадает в отчёт со ссылкой на старое сообщение.
 */
export async function repairChat(orders: CrmOrder[]): Promise<RepairResult> {
  const result: RepairResult = { checked: 0, alreadyOk: 0, moved: 0, stuck: [], failed: 0 };
  const topics = await chatTopics();
  if (!topics) return result;
  let first = true;
  for (const o of orders) {
    if (o.deletedAt || o.tgChatId !== topics.chatId || o.tgMessageId === null) continue;
    const target = threadFor(o, topics.threads);
    if (!target) continue;
    result.checked++;
    if (o.tgThreadId === target) {
      result.alreadyOk++;
      continue;
    }
    if (!first) await new Promise((r) => setTimeout(r, PAUSE_MS));
    first = false;
    const actual = o.tgThreadId ?? (await probeThread(o));
    if (actual === null) {
      result.failed++;
      continue;
    }
    if (actual === target) {
      await editInPlace({ ...o, tgThreadId: actual }); // убирает невидимый символ пробы и запоминает тему
      await saveOrder(o.code, { tg_thread_id: actual });
      result.alreadyOk++;
      continue;
    }
    const url = `https://t.me/c/${String(topics.chatId).replace(/^-100/, "")}/${o.tgMessageId}`;
    const status = await relocateOrderMessage(o, topics.chatId, target, true, true);
    if (status === "moved") result.moved++;
    else if (status === "stuck") result.stuck.push({ code: o.code, name: o.name, url });
    else result.failed++;
  }
  return result;
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
