import { crmEnabled, listOrders } from "@/lib/crm/db";
import { bad, crash, ok, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  const url = new URL(req.url);
  const doneDays = Math.min(Math.max(Number(url.searchParams.get("doneDays")) || 30, 1), 3650);
  try {
    const orders = await listOrders({ doneDays, q: url.searchParams.get("q") ?? undefined });
    return ok({ orders, me: user, bot: (process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "") });
  } catch (error) {
    return crash("list", error);
  }
}
