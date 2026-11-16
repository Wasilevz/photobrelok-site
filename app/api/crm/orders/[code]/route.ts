import { getOrderDetails } from "@/lib/crm/db";
import type { OrderPatch } from "@/lib/crm/model";
import { changeOrder } from "@/lib/crm/stage";
import { CODE_RE, bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  const { code } = await params;
  if (!CODE_RE.test(code)) return bad("Неверный номер заказа");
  try {
    const details = await getOrderDetails(code);
    return details ? ok(details) : bad("Заказ не найден", 404);
  } catch (error) {
    return crash("get", error);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  const { code } = await params;
  if (!CODE_RE.test(code)) return bad("Неверный номер заказа");
  const body = await readJson(req);
  if (!body) return bad("Некорректные данные");
  try {
    const result = await changeOrder(code, body as OrderPatch, user);
    return result.ok ? ok({ order: result.order, warnings: result.warnings }) : bad(result.error, result.status);
  } catch (error) {
    return crash("patch", error);
  }
}
