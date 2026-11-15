import { crmEnabled, getSender } from "@/lib/crm/db";
import { signFormsLink } from "@/lib/crm/post-forms/link";
import { CODE_RE, bad, crash, ok, readJson, requireUser } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

/** Ссылка на PDF с почтовыми бланками для заказов { codes } (10 минут). */
export async function POST(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  const body = await readJson(req);
  const codes = Array.isArray(body?.codes) ? [...new Set(body.codes.filter((c): c is string => typeof c === "string" && CODE_RE.test(c)))] : [];
  if (codes.length === 0 || codes.length > 100) return bad("Выберите заказы");
  try {
    if (!(await getSender())) return bad("Сначала заполните данные отправителя", 409);
    const query = signFormsLink(codes, process.env.TELEGRAM_BOT_TOKEN ?? "", Math.floor(Date.now() / 1000));
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau" }).format(new Date());
    const fileName = codes.length === 1 ? `Posta_${codes[0]}.pdf` : `Posta_${day}_${codes.length}.pdf`;
    return ok({ url: `${new URL(req.url).origin}/api/crm/post-forms/file?${query}`, fileName });
  } catch (error) {
    return crash("post forms link", error);
  }
}
