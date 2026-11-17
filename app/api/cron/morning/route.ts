import { timingSafeEqual } from "node:crypto";
import { tg } from "@/lib/telegram-orders";
import { crmEnabled, listOrders } from "@/lib/crm/db";
import { morningSummary } from "@/lib/crm/morning";
import { chatTopics } from "@/lib/crm/topics";
import { bad, crash, ok, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

/** Сводка уходит в тему «В производстве» — её открывают первой утром. */
async function sendSummary(): Promise<Response> {
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  const topics = await chatTopics();
  if (!topics) return bad("Темы чата не настроены", 503);
  try {
    const orders = await listOrders({ doneDays: 90 });
    const bot = (process.env.TELEGRAM_BOT_USERNAME ?? "").trim().replace(/^@/, "");
    await tg("sendMessage", {
      chat_id: topics.chatId,
      message_thread_id: topics.threads.production,
      text: morningSummary(orders, new Date()),
      ...(bot ? { reply_markup: { inline_keyboard: [[{ text: "📋 Открыть CRM", url: `https://t.me/${bot}/crm` }]] } } : {}),
    });
    return ok({ sent: true });
  } catch (error) {
    return crash("morning summary", error);
  }
}

/** Vercel Cron, каждое утро (vercel.json). Vercel присылает заголовок Authorization: Bearer <CRON_SECRET>. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (!secret || got.length !== want.length || !timingSafeEqual(got, want)) return bad("Нет доступа", 401);
  return sendSummary();
}

/** Кнопка в CRM «Прислать сводку сейчас». */
export async function POST(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  return sendSummary();
}
