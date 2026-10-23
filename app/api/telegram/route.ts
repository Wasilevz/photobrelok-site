import { NextResponse } from "next/server";

const ORDER_ID_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export async function POST(req: Request) {
  try {
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

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatIds = (process.env.TELEGRAM_CHAT_ID || "").split(",").map((id) => id.trim()).filter(Boolean);
    if (!botToken || chatIds.length === 0) {
      return NextResponse.json({ error: "Telegram не настроен" }, { status: 500 });
    }

    // Never forward arbitrary user-supplied text to the internal Telegram chat.
    const message = `🔥 <b>АПСЕЛЛ! Заявка #${orderId}</b>\nКлиент добавил второй брелок со скидкой 40%.\nПоложите 2 шт. в заказ.`;
    const results = await Promise.allSettled(
      chatIds.map(async (chatId) => {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`Telegram returned ${response.status}`);
      }),
    );

    if (!results.some((result) => result.status === "fulfilled")) {
      console.error("Upsell notification could not be delivered to Telegram");
      return NextResponse.json({ error: "Не удалось передать добавление менеджеру" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Upsell notification failed:", error);
    return NextResponse.json({ error: "Не удалось передать добавление менеджеру" }, { status: 500 });
  }
}
