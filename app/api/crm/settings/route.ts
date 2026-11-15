import { crmEnabled, getCosts, parseCosts, saveCosts } from "@/lib/crm/db";
import { bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  try {
    return ok({ costs: await getCosts() });
  } catch (error) {
    return crash("settings", error);
  }
}

export async function PUT(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  const body = (await readJson(req)) as { costs?: unknown } | null;
  const costs = parseCosts(body?.costs);
  if (!costs) return bad("Себестоимость — числа от 0");
  try {
    await saveCosts(costs, user);
    return ok({ costs });
  } catch (error) {
    return crash("settings save", error);
  }
}
