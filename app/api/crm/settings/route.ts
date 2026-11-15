import { crmEnabled, getCosts, getSender, parseCosts, saveCosts, saveSender } from "@/lib/crm/db";
import { parseSender } from "@/lib/crm/post-forms/data";
import { bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  try {
    const [costs, sender] = await Promise.all([getCosts(), getSender()]);
    return ok({ costs, sender });
  } catch (error) {
    return crash("settings", error);
  }
}

/** Тело: { costs } — себестоимость, или { sender } — отправитель для почтовых бланков. */
export async function PUT(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  const body = await readJson(req);
  try {
    if (body && "sender" in body) {
      const parsed = parseSender(body.sender);
      if (!parsed.ok) return bad(parsed.error);
      await saveSender(parsed.value, user);
      return ok({ sender: parsed.value });
    }
    const costs = parseCosts(body?.costs);
    if (!costs) return bad("Себестоимость — числа от 0");
    await saveCosts(costs, user);
    return ok({ costs });
  } catch (error) {
    return crash("settings save", error);
  }
}
