import { crmEnabled, getCosts, getPrint, getSender, parseCosts, savePrint, saveCosts, saveSender } from "@/lib/crm/db";
import { parsePrint, parseSender } from "@/lib/crm/post-forms/data";
import { bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  try {
    const [costs, sender, print] = await Promise.all([getCosts(), getSender(), getPrint()]);
    return ok({ costs, sender, print });
  } catch (error) {
    return crash("settings", error);
  }
}

/** Тело: { costs } — себестоимость, { sender } — отправитель на бланках, { print } — размеры бланков и сдвиг печати. */
export async function PUT(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  const body = await readJson(req);
  try {
    if (body && "print" in body) {
      const print = parsePrint(body.print);
      await savePrint(print, user);
      return ok({ print });
    }
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
