import { getOrder, purgeOrder } from "@/lib/crm/db";
import { deleteOrderMessage } from "@/lib/crm/telegram";
import { CODE_RE, bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

/**
 * «Удалить заказ» — полностью и безвозвратно (решение владельца): сообщение в чате, PDF, комментарии, история, строка.
 * Тело { confirm: "<код>" } — защита от случайного нажатия.
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
    if (!order) return ok({ chat: "none" });
    const chat = await deleteOrderMessage(order);
    await purgeOrder(code);
    console.log(`CRM ${code}: удалён полностью (${user.name}), чат: ${chat}`);
    return ok({ chat });
  } catch (error) {
    return crash("purge", error);
  }
}
