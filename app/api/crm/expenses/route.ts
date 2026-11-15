import { addExpense, crmEnabled } from "@/lib/crm/db";
import { parseExpense } from "@/lib/crm/expenses";
import { bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  const parsed = parseExpense(await readJson(req));
  if (!parsed.ok) return bad(parsed.error);
  try {
    await addExpense(parsed.value, user);
    return ok({ ok: true });
  } catch (error) {
    return crash("expense add", error);
  }
}
