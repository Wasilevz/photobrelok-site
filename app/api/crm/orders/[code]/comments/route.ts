import { addComment, getOrder, listComments } from "@/lib/crm/db";
import { CODE_RE, bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  const { code } = await params;
  if (!CODE_RE.test(code)) return bad("Неверный номер заказа");
  const body = await readJson(req);
  const text = typeof body?.text === "string" ? body.text.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim() : "";
  if (!text) return bad("Комментарий пустой");
  if (text.length > 1000) return bad("Комментарий длиннее 1000 символов");
  try {
    if (!(await getOrder(code))) return bad("Заказ не найден", 404);
    await addComment(code, user, text);
    return ok({ comments: await listComments(code) });
  } catch (error) {
    return crash("comment", error);
  }
}
