import { crmEnabled, updateExpense } from "@/lib/crm/db";
import { parseExpense } from "@/lib/crm/expenses";
import { bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  const { id } = await params;
  if (!UUID.test(id)) return bad("Неверный расход");
  const parsed = parseExpense(await readJson(req), true);
  if (!parsed.ok) return bad(parsed.error);
  try {
    if (!(await updateExpense(id, parsed.value, user))) return bad("Расход не найден", 404);
    return ok({ ok: true });
  } catch (error) {
    return crash("expense update", error);
  }
}
