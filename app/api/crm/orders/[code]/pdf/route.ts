import { getOrder, signedPdfUrl } from "@/lib/crm/db";
import { CODE_RE, bad, crash, ok, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

/** Ссылка на скачивание PDF (10 минут). */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  const { code } = await params;
  if (!CODE_RE.test(code)) return bad("Неверный номер заказа");
  try {
    const order = await getOrder(code);
    if (!order) return bad("Заказ не найден", 404);
    if (!order.pdfPath) return bad("PDF этого заказа есть только в чате Telegram", 404);
    return ok({ url: await signedPdfUrl(order.pdfPath, code), fileName: `Brelok_${code}.pdf` });
  } catch (error) {
    return crash("pdf", error);
  }
}
