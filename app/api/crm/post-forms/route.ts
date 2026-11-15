import { crmEnabled, getSender } from "@/lib/crm/db";
import { signFormsLink } from "@/lib/crm/post-forms/link";
import { CODE_RE, bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

/**
 * Ссылка на PDF для печати на готовые бланки (10 минут).
 * Тело: { codes, kind: "ramburs" | "tfp3", test?: true } — test без заказов печатает образец.
 */
export async function POST(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  const body = await readJson(req);
  const kind = body?.kind === "tfp3" ? "tfp3" : body?.kind === "ramburs" ? "ramburs" : null;
  const test = body?.test === true;
  const codes = Array.isArray(body?.codes) ? [...new Set(body.codes.filter((c): c is string => typeof c === "string" && CODE_RE.test(c)))] : [];
  if (!kind) return bad("Неизвестный бланк");
  if ((codes.length === 0 && !test) || codes.length > 100) return bad("Выберите заказы");
  try {
    if (!test && !(await getSender())) return bad("Сначала заполните данные отправителя", 409);
    const query = signFormsLink({ codes, kind, test }, process.env.TELEGRAM_BOT_TOKEN ?? "", Math.floor(Date.now() / 1000));
    const what = kind === "tfp3" ? "TFP-3" : "Otpravlenie";
    const fileName = test ? `Proba_${what}.pdf` : codes.length === 1 ? `${what}_${codes[0]}.pdf` : `${what}_${codes.length}.pdf`;
    return ok({ url: `${new URL(req.url).origin}/api/crm/post-forms/file?${query}`, fileName });
  } catch (error) {
    return crash("post forms link", error);
  }
}
