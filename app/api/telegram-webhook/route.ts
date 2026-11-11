import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { type TgUpdate, handleUpdate } from "@/lib/telegram-bot";
import { tg } from "@/lib/telegram-orders";

// Вебхук Telegram-бота: кнопки под заказами и ответы-правки.
// Регистрируется командой `npm run telegram:webhook -- https://<домен>` (см. README).

function secretMatches(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Telegram webhook is not configured: TELEGRAM_WEBHOOK_SECRET is missing");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await handleUpdate(update);
  } catch (error) {
    // Всегда отвечаем 200, иначе Telegram будет повторять один и тот же апдейт.
    console.error("Telegram update failed:", error instanceof Error ? error.message : error);
  }
  return NextResponse.json({ ok: true });
}

// Подключение вебхука с самого сервера (токен бота остаётся на Vercel):
// откройте /api/telegram-webhook?setup=<TELEGRAM_WEBHOOK_SECRET> один раз после деплоя.
export async function GET(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const url = new URL(request.url);
  if (!secret || !secretMatches(url.searchParams.get("setup"), secret)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  try {
    const webhookUrl = `${url.origin}/api/telegram-webhook`;
    await tg("setWebhook", {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    return NextResponse.json({ ok: true, webhook: webhookUrl });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 502 });
  }
}
