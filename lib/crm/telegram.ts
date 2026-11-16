// Связь CRM с чатом: правка подписи сообщения заказа и отправка PDF в личку.
// Запрет владельца: сообщения не удаляются и не переносятся — только editMessageCaption.
import { tg } from "../telegram-orders.ts";
import { buildCrmCaption } from "./caption.ts";
import { crmKeyboard } from "./links.ts";
import type { CrmOrder } from "./model.ts";
import { downloadPdf, saveOrder } from "./db.ts";

/** Обновляет подпись сообщения заказа в чате. Ошибки Telegram не мешают работе CRM — только в лог. */
export async function syncOrderMessage(o: CrmOrder): Promise<void> {
  if (o.tgChatId === null || o.tgMessageId === null) return;
  const caption = buildCrmCaption(o);
  try {
    const markup = crmKeyboard(o.code);
    await tg("editMessageCaption", {
      chat_id: o.tgChatId,
      message_id: o.tgMessageId,
      caption,
      ...(markup.length > 0 ? { reply_markup: { inline_keyboard: markup } } : {}),
    });
    await saveOrder(o.code, { tg_caption: caption });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/message is not modified/i.test(message)) return;
    console.error(`CRM ${o.code}: chat caption not updated: ${message}`);
  }
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
    return "failed";
  }
}
