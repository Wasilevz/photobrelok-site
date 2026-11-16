// Связь CRM с чатом производства: заказ лежит в теме своей стадии с кнопками следующего шага.
// Удаления сообщений — только при переносе между темами (копия с PDF остаётся) и при «Удалить заказ».
import { tg } from "../telegram-orders.ts";
import { buildCrmCaption } from "./caption.ts";
import { chatKeyboard, threadFor } from "./chat.ts";
import { type CrmOrder, stageLabel } from "./model.ts";
import { chatTopics } from "./topics.ts";
import { getSetting, saveSetting } from "./db.ts";
import { downloadPdf, saveOrder } from "./db.ts";

const bot = () => process.env.TELEGRAM_BOT_USERNAME;
const NOT_MODIFIED = /message is not modified/i;

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
 * Перенос заказа в тему его стадии (решение владельца): Telegram не умеет двигать сообщения, поэтому
 * копия с тем же PDF — в нужную тему, затем старое сообщение удаляется. Не удалось удалить (старше 48 ч, нет
 * права) — старое остаётся с пометкой «перенесён» и без кнопок. Не удалось скопировать — правим на месте.
 */
async function relocateOrderMessage(o: CrmOrder, chatId: number, threadId: number): Promise<void> {
  const caption = buildCrmCaption(o);
  let copied: { message_id: number };
  try {
    copied = await tg<{ message_id: number }>("copyMessage", {
      chat_id: chatId,
      from_chat_id: o.tgChatId,
      message_id: o.tgMessageId,
      message_thread_id: threadId,
      caption,
      reply_markup: { inline_keyboard: chatKeyboard(o, bot()) },
    });
  } catch (error) {
    console.error(`CRM ${o.code}: not moved to topic ${threadId}:`, error instanceof Error ? error.message : error);
    return editInPlace(o);
  }
  await saveOrder(o.code, { tg_chat_id: chatId, tg_message_id: copied.message_id, tg_thread_id: threadId, tg_caption: caption });
  try {
    await tg("deleteMessage", { chat_id: o.tgChatId, message_id: o.tgMessageId });
    await deleteStaleCopies().catch(() => {}); // удаление работает — дочищаем старые копии из очереди
  } catch (error) {
    console.error(`CRM ${o.code}: old message not deleted:`, error instanceof Error ? error.message : error);
    await rememberStaleCopy({ code: o.code, chatId: o.tgChatId as number, messageId: o.tgMessageId as number });
    await tg("editMessageCaption", {
      chat_id: o.tgChatId,
      message_id: o.tgMessageId,
      caption: `➡️ Перенесён в тему «${stageLabel(o.stage, o.method)}» — это старая копия\n\n${caption}`.slice(0, 1000),
      reply_markup: { inline_keyboard: [] },
    }).catch(() => {});
  }
}

type StaleCopy = { code: string; chatId: number; messageId: number };
const STALE_KEY = "stale_copies";

/** Старая копия, которую Telegram не дал удалить (нет права «Удаление сообщений»): удалим позже. */
async function rememberStaleCopy(copy: StaleCopy): Promise<void> {
  try {
    const list = (await getSetting<StaleCopy[]>(STALE_KEY)) ?? [];
    if (!list.some((c) => c.chatId === copy.chatId && c.messageId === copy.messageId)) await saveSetting(STALE_KEY, [...list, copy].slice(-200));
  } catch (error) {
    console.error("CRM: stale copy not remembered:", error instanceof Error ? error.message : error);
  }
}

/**
 * Удаляет старые копии заказов, оставшиеся после переноса между темами (когда у бота не было права удалять).
 * Только сообщения из этого списка — их новые копии с PDF уже лежат в нужных темах. Возвращает, сколько удалено.
 */
export async function deleteStaleCopies(): Promise<{ deleted: number; left: number }> {
  const list = (await getSetting<StaleCopy[]>(STALE_KEY)) ?? [];
  if (list.length === 0) return { deleted: 0, left: 0 };
  const left: StaleCopy[] = [];
  for (const c of list) {
    try {
      await tg("deleteMessage", { chat_id: c.chatId, message_id: c.messageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/message to delete not found/i.test(message)) left.push(c);
    }
  }
  await saveSetting(STALE_KEY, left);
  return { deleted: list.length - left.length, left: left.length };
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
  if (target && target !== current) return relocateOrderMessage(next, topics.chatId, target);
  return editInPlace(next);
}

export type SendPdfResult = "sent" | "start_bot" | "no_pdf";

const NO_PRIVATE_CHAT = /bot can't initiate|chat not found|bot was blocked|user is deactivated|forbidden/i;

/** Присылает PDF заказа в личный чат с ботом — как документ, тем же путём, что в группе. */
export async function sendPdfTo(userId: number, o: CrmOrder): Promise<SendPdfResult> {
  try {
    if (o.tgChatId !== null && o.tgMessageId !== null) {
      // Копия сообщения из группы (оригинал не трогается). Работает и для старых заказов.
      await tg("copyMessage", { chat_id: userId, from_chat_id: o.tgChatId, message_id: o.tgMessageId });
      return "sent";
    }
    if (!o.pdfPath) return "no_pdf";
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
    const form = new FormData();
    form.append("chat_id", String(userId));
    form.append("caption", `Заказ #${o.code} · ${o.name}`);
    form.append("document", new Blob([new Uint8Array(await downloadPdf(o.pdfPath))], { type: "application/pdf" }), `Brelok_${o.code}.pdf`);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!json?.ok) throw new Error(json?.description || `sendDocument failed: ${res.status}`);
    return "sent";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (NO_PRIVATE_CHAT.test(message)) return "start_bot";
    throw error;
  }
}

/**
 * Удаляет сообщение заказа из чата — только при полном удалении заказа кнопкой «Удалить заказ».
 * Telegram позволяет боту удалять сообщения не старше 48 часов (или если бот — админ с правом удаления).
 */
export async function deleteOrderMessage(o: CrmOrder): Promise<"deleted" | "none" | "failed"> {
  if (o.tgChatId === null || o.tgMessageId === null) return "none";
  try {
    await tg("deleteMessage", { chat_id: o.tgChatId, message_id: o.tgMessageId });
    return "deleted";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/message to delete not found/i.test(message)) return "deleted";
    console.error(`CRM ${o.code}: chat message not deleted: ${message}`);
    await rememberStaleCopy({ code: o.code, chatId: o.tgChatId, messageId: o.tgMessageId });
    return "failed";
  }
}
