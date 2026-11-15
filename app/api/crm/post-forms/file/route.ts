import { getOrder, getSender } from "@/lib/crm/db";
import { formData } from "@/lib/crm/post-forms/data";
import { verifyFormsLink } from "@/lib/crm/post-forms/link";
import { buildPostFormsPdf } from "@/lib/crm/post-forms/pdf";
import { crash } from "@/lib/crm/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PDF с бланками по подписанной ссылке (её выдаёт POST /api/crm/post-forms). Только заказы почтой Молдовы. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const codes = verifyFormsLink(url.searchParams, process.env.TELEGRAM_BOT_TOKEN ?? "", Math.floor(Date.now() / 1000));
  if (!codes || !process.env.TELEGRAM_BOT_TOKEN) return new Response("Ссылка устарела — нажмите кнопку ещё раз", { status: 403 });
  try {
    const [sender, ...orders] = await Promise.all([getSender(), ...codes.map((c) => getOrder(c))]);
    if (!sender) return new Response("Не заполнены данные отправителя", { status: 409 });
    const forms = orders.filter((o) => o !== null && o.method === "posta").map((o) => formData(o!, sender));
    if (forms.length === 0) return new Response("Нет заказов почтой Молдовы", { status: 404 });
    const pdf = await buildPostFormsPdf(forms, sender);
    const name = codes.length === 1 ? `Posta_${codes[0]}.pdf` : `Posta_${codes.length}.pdf`;
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return crash("post forms pdf", error);
  }
}
