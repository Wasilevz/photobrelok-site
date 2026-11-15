import { crmEnabled, getCosts, listExpenses, reportRows } from "@/lib/crm/db";
import { bad, crash, ok, requireUser } from "@/lib/crm/api";
import { type Period, buildReport, periodRange } from "@/lib/crm/reports";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["today", "7d", "month", "prev_month", "custom"];

export async function GET(req: Request) {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (!crmEnabled()) return bad("CRM не настроена: нет ключей Supabase", 503);
  const url = new URL(req.url);
  const period = (url.searchParams.get("period") ?? "month") as Period;
  if (!PERIODS.includes(period)) return bad("Неизвестный период");
  const range = periodRange(period, new Date(), url.searchParams.get("from"), url.searchParams.get("to"));
  if (!range) return bad("Проверьте даты периода (не больше 400 дней)");
  try {
    const [rows, costs, expenses] = await Promise.all([reportRows(range.from, range.to), getCosts(), listExpenses(range.from, range.to)]);
    return ok({ report: buildReport(rows, range.from, range.to, costs, expenses), expenses });
  } catch (error) {
    return crash("report", error);
  }
}
