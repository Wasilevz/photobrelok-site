import { addHistory, getOrder, hideOrder } from "@/lib/crm/db";
import { syncOrderMessage } from "@/lib/crm/telegram";
import { CODE_RE, bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

/**
 * «Удалить заказ» (тестовый/ошибочный): убрать из CRM и отчётов. Тело { confirm: "<код>" } — защита от случайного
 * нажатия. Строка в базе, PDF и сообщение в чате остаются (запрет владельца); в подписи — «🗑 Удалён из CRM».
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  const { code } = await params;
  if (!CODE_RE.test(code)) return bad("Неверный номер заказа");
  const body = await readJson(req);
  if (body?.confirm !== code) return bad("Подтвердите удаление");
  try {
    const order = await getOrder(code);
    if (!order) return bad("Заказ не найден", 404);
    if (order.deletedAt) return ok({ ok: true });
    const at = await hideOrder(code, user);
    await addHistory(code, user, "deleted", {});
    await syncOrderMessage({ ...order, deletedAt: at });
    return ok({ ok: true });
  } catch (error) {
    return crash("hide", error);
  }
}
