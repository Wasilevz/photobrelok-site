import { crmEnabled, listOrders } from "@/lib/crm/db";
import { syncChat } from "@/lib/crm/telegram";
import { bad, crash, ok, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Один раз после перехода на чат по стадиям: поставить кнопки стадий под всеми незавершёнными заказами
 * (у старых сообщений кнопка-ссылка, которая сама не обновится). Пауза — лимит Telegram на правки в группе.
 */
export async function POST(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  try {
    const orders = (await listOrders({ doneDays: 1 })).filter((o) => o.stage !== "done" && o.tgMessageId !== null);
    for (const [i, o] of orders.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1500));
      await syncChat(o, o);
    }
    return ok({ updated: orders.length });
  } catch (error) {
    return crash("chat refresh", error);
  }
}
