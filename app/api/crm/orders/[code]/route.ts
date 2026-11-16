import { addHistory, getOrder, listComments, listHistory, saveOrder } from "@/lib/crm/db";
import { type OrderPatch, applyPatch, orderToRow } from "@/lib/crm/model";
import { syncOrderMessage } from "@/lib/crm/telegram";
import { CODE_RE, bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  const { code } = await params;
  if (!CODE_RE.test(code)) return bad("Неверный номер заказа");
  try {
    const order = await getOrder(code);
    if (!order) return bad("Заказ не найден", 404);
    const [comments, history] = await Promise.all([listComments(code), listHistory(code)]);
    return ok({ order, comments, history });
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
    const current = await getOrder(code);
    if (!current) return bad("Заказ не найден", 404);
    if (current.deletedAt) return bad("Заказ удалён из CRM", 409);
    const result = applyPatch(current, body as OrderPatch, new Date());
    if (!result.ok) return bad(result.error);
    const { next, changed, warnings } = result;
    if (changed.length === 0) return ok({ order: current, warnings });

    // Сохраняем только изменённые поля: параллельная правка другого поля не затирается.
    const row = orderToRow(Object.fromEntries(changed.map((k) => [k, next[k]])));
    if (changed.includes("stage")) row.stage_changed_at = next.stageChangedAt;
    await saveOrder(code, row);

    if (changed.includes("stage")) await addHistory(code, user, "stage", { from: current.stage, to: next.stage });
    const fields = changed.filter((k) => k !== "stage");
    if (fields.length > 0) {
      await addHistory(code, user, "field", Object.fromEntries(fields.map((k) => [k, [current[k], next[k]]])));
    }
    await syncOrderMessage(next);
    return ok({ order: next, warnings });
  } catch (error) {
    return crash("patch", error);
  }
}
