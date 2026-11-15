import { getOrder, getPrint, getSender } from "@/lib/crm/db";
import { type FormData, type Sender, formData } from "@/lib/crm/post-forms/data";
import { verifyFormsLink } from "@/lib/crm/post-forms/link";
import { buildBlankPdf } from "@/lib/crm/post-forms/pdf";
import { crash } from "@/lib/crm/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Образец для пробной печати — данные из образца заполнения почты. */
const SAMPLE_SENDER: Sender = {
  name: "Ion Scutaru", street: "bd. Dacia, 8, ap. 8", locality: "MD-2060, CHIȘINĂU", phone: "022 123 456",
  payout: "address", idnp: "", iban: "", parcelType: "pachet", declareValue: true,
};
const SAMPLE_ORDER = {
  code: "PROBA1", name: "Ana Scutaru", phone: "0231 123 456", method: "posta" as const, postalCode: "MD-2031",
  city: "Bălți", district: "Bălți", street: "str. Decebal, 25, ap. 4", qty: 2, urgent: false, price: null, paid: false,
};

/** PDF по подписанной ссылке (её выдаёт POST /api/crm/post-forms). Только заказы почтой Молдовы. */
export async function GET(req: Request) {
  const link = verifyFormsLink(new URL(req.url).searchParams, process.env.TELEGRAM_BOT_TOKEN ?? "", Math.floor(Date.now() / 1000));
  if (!link || !process.env.TELEGRAM_BOT_TOKEN) return new Response("Ссылка устарела — нажмите кнопку ещё раз", { status: 403 });
  try {
    const [saved, print, ...orders] = await Promise.all([getSender(), getPrint(), ...link.codes.map((c) => getOrder(c))]);
    const sender = saved ?? (link.test ? SAMPLE_SENDER : null);
    if (!sender) return new Response("Не заполнены данные отправителя", { status: 409 });
    let forms: FormData[] = orders.filter((o) => o !== null && o.method === "posta").map((o) => formData(o!, sender));
    if (link.test && link.codes.length === 0) forms = [formData(SAMPLE_ORDER, sender)];
    if (link.kind === "tfp3") forms = forms.filter((f) => f.cod);
    if (forms.length === 0) {
      const why = link.kind === "tfp3" ? "Нет заказов с наложенным платежом — TFP-3 не нужен" : "Нет заказов почтой Молдовы";
      return new Response(why, { status: 404 });
    }
    const pdf = await buildBlankPdf(forms, sender, link.kind, print[link.kind], { test: link.test });
    const what = link.kind === "tfp3" ? "TFP-3" : "Otpravlenie";
    const name = link.test ? `Proba_${what}.pdf` : forms.length === 1 ? `${what}_${forms[0].code}.pdf` : `${what}_${forms.length}.pdf`;
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
