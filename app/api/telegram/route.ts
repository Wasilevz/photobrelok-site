import { NextResponse } from "next/server";
import { clientIp, isSameOrigin, rateLimit } from "@/lib/antispam";
import { getOrderRecipients, tg } from "@/lib/telegram-orders";

const ORDER_ID_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: "Запрос отклонён" }, { status: 403 });
    }
    if (!rateLimit(`upsell:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    }

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 1024) {
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

    const recipients = getOrderRecipients();
    if (!process.env.TELEGRAM_BOT_TOKEN || recipients.length === 0) {
      console.error("Upsell: Telegram is not configured (token or chat id is missing)");
      return NextResponse.json({ error: "Telegram не настроен" }, { status: 500 });
    }

    // Never forward arbitrary user-supplied text to the internal Telegram chat.
    const text = `🔥 <b>АПСЕЛЛ! Заявка #${orderId}</b>\nКлиент добавил второй брелок со скидкой 40%.\nПоложите 2 шт. в заказ.`;
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
