import { crmEnabled, listOrders } from "@/lib/crm/db";
import { repairChat } from "@/lib/crm/telegram";
import { bad, crash, ok, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * «Выровнять чат по CRM»: переносит заказы, которые в чате лежат не в теме своей стадии. Безопасно запускать повторно —
 * уже проверенные заказы пропускаются (тема запоминается).
 */
export async function POST(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  try {
    const orders = (await listOrders({ doneDays: 60 })).filter((o) => o.tgMessageId !== null);
    const result = await repairChat(orders);
    console.log(`CRM chat repair (${user.name}): checked ${result.checked}, ok ${result.alreadyOk}, moved ${result.moved}, stuck ${result.stuck.length}, failed ${result.failed}`);
    return ok(result);
  } catch (error) {
    return crash("chat repair", error);
  }
}
