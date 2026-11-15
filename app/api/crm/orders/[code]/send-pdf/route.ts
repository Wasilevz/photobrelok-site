import { getOrder } from "@/lib/crm/db";
import { sendPdfTo } from "@/lib/crm/telegram";
import { CODE_RE, bad, crash, ok, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

/** Бот присылает PDF заказа нажавшему в личный чат. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  const { code } = await params;
  if (!CODE_RE.test(code)) return bad("Неверный номер заказа");
  try {
    const order = await getOrder(code);
    if (!order) return bad("Заказ не найден", 404);
    return ok({ result: await sendPdfTo(user.id, order) });
  } catch (error) {
    return crash("send-pdf", error);
  }
}
