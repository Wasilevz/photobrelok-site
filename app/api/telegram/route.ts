import { NextResponse, after } from "next/server";
import { clientIp, isSameOrigin, rateLimit } from "@/lib/antispam";
import {
  withUpsell,
  getOrderRecipients,
  getTopicConfig,
  keyboard,
  readUpsellToken,
  tg,
} from "@/lib/telegram-orders";

const ORDER_ID_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

const NOTICE_TTL_MS = 60_000; // функция на Vercel живёт недолго, поэтому ждём всего минуту

/** Ответ на сообщение заказа со звуком; через минуту удаляется. Ошибки не важны: блок в подписи уже есть. */
function notifyUpsell(orderId: string, ref: { chatId: string; messageId: number; threadId?: number }) {
  after(async () => {
    try {
      const sent = await tg<{ message_id: number }>("sendMessage", {
        chat_id: ref.chatId,
        text: `⚠️ К заказу #${orderId} добавлен ВТОРОЙ БРЕЛОК. Смотрите блок «АПСЕЛЛ» в заказе.`,
        reply_parameters: { message_id: ref.messageId, allow_sending_without_reply: true },
        ...(ref.threadId !== undefined ? { message_thread_id: ref.threadId } : {}),
      });
      await new Promise((resolve) => setTimeout(resolve, NOTICE_TTL_MS));
      await tg("deleteMessage", { chat_id: ref.chatId, message_id: sent.message_id });
    } catch (error) {
      console.error(`Upsell ${orderId}: notice failed: ${error instanceof Error ? error.message : error}`);
    }
  });
}

export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: "Запрос отклонён" }, { status: 403 });
    }
    if (!rateLimit(`upsell:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    }

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 8192) {
      return NextResponse.json({ error: "Слишком большой запрос" }, { status: 413 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
    }

    const orderId = (body as Record<string, unknown>).orderId;
    if (typeof orderId !== "string" || !ORDER_ID_PATTERN.test(orderId)) {
      return NextResponse.json({ error: "Некорректный номер заказа" }, { status: 400 });
    }

    // 1) Основной путь: дописываем апселл прямо в сообщение заказа. Дальше бот переносит заказ
    //    по темам вместе с подписью, то есть апселл едет туда же, куда и сам заказ.
    const payload = readUpsellToken((body as Record<string, unknown>).token, orderId);
    if (payload && payload.refs.length > 0) {
      const topics = getTopicConfig();
      const caption = withUpsell(payload.caption);
      const edits = await Promise.allSettled(
        payload.refs.map(async (ref): Promise<"edited" | "same"> => {
          const withKeyboard = topics && ref.chatId === topics.chatId && ref.threadId !== undefined;
          try {
            await tg("editMessageCaption", {
              chat_id: ref.chatId,
              message_id: ref.messageId,
              caption,
              ...(withKeyboard ? { reply_markup: { inline_keyboard: keyboard("work", topics) } } : {}),
            });
            return "edited";
          } catch (error) {
            // Повторное нажатие даёт ту же подпись — это не ошибка
            if (error instanceof Error && /message is not modified/i.test(error.message)) return "same";
            throw error;
          }
        }),
      );
      edits.forEach((r) => {
        if (r.status === "rejected") {
          console.error(`Upsell ${orderId}: caption edit failed: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
        }
      });
      if (edits.some((r) => r.status === "fulfilled")) {
        // Правка подписи не даёт уведомления, поэтому шлём короткий ответ на заказ: он приходит
        // со звуком и сам удаляется. Сам блок апселла остаётся в подписи и едет вместе с заказом.
        payload.refs.forEach((ref, i) => {
          const edit = edits[i];
          if (edit.status === "fulfilled" && edit.value === "edited") notifyUpsell(orderId, ref);
        });
        return NextResponse.json({ success: true });
      }
      // Сообщение заказа уже перенесено или удалено — падаем на отдельное уведомление ниже
    }

    // 2) Запасной путь: нет токена (старая вкладка, sessionStorage недоступен) или заказ уже переехал.
    const recipients = getOrderRecipients();
    if (!process.env.TELEGRAM_BOT_TOKEN || recipients.length === 0) {
      console.error("Upsell: Telegram is not configured (token or chat id is missing)");
      return NextResponse.json({ error: "Telegram не настроен" }, { status: 500 });
    }

    // Never forward arbitrary user-supplied text to the internal Telegram chat.
    const text = `⚠️⚠️ <b>АПСЕЛЛ! Заявка #${orderId}</b> ⚠️⚠️\nКлиент добавил второй брелок со скидкой 40% (150 лей).\n<b>Положите 2 шт. в заказ.</b>`;
    const results = await Promise.allSettled(
      recipients.map(async ({ chatId, threadId }) => {
        const base = { chat_id: chatId, text, parse_mode: "HTML" };
        try {
          // В группе с темами апселл ложится рядом с заказами, в тему «В работе»
          await tg("sendMessage", threadId ? { ...base, message_thread_id: threadId } : base);
        } catch (error) {
          if (!threadId) throw error;
          console.error(`Upsell ${orderId}: send to topic failed (${error instanceof Error ? error.message : error}), retrying without topic`);
          await tg("sendMessage", base);
        }
      }),
    );

    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    failures.forEach((r) =>
      console.error(`Upsell ${orderId}: Telegram delivery failed: ${r.reason instanceof Error ? r.reason.message : r.reason}`),
    );
    if (failures.length === results.length) {
      return NextResponse.json({ error: "Не удалось передать добавление менеджеру" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Upsell notification failed:", error);
    return NextResponse.json({ error: "Не удалось передать добавление менеджеру" }, { status: 500 });
  }
}
