// Отчёты CRM: заказы, брелки и суммы за период, по дням Кишинёва. Чистые функции — без базы.
import { addDays, chisinauToday, isDay } from "../delivery-dates.ts";
import type { DeliveryMethod } from "../order-fields.ts";
import { type CrmOrder, METHODS, orderPrice } from "./model.ts";

export type ReportRow = Pick<CrmOrder, "createdAt" | "qty" | "urgent" | "price" | "stage" | "method">;
type Totals = { orders: number; keychains: number; revenue: number };
export type ReportDay = Totals & { day: string };
export type Report = Totals & {
  from: string;
  to: string;
  avgCheck: number;
  urgent: number;
  done: Totals;
  days: ReportDay[];
  methods: (Totals & { method: DeliveryMethod })[];
};

const zero = (): Totals => ({ orders: 0, keychains: 0, revenue: 0 });
function add(t: Totals, r: ReportRow): void {
  t.orders += 1;
  t.keychains += r.qty;
  t.revenue += orderPrice(r);
}

export const MAX_REPORT_DAYS = 400;

export function buildReport(rows: ReportRow[], from: string, to: string): Report {
  const total = zero();
  const done = zero();
  const byDay = new Map<string, ReportDay>();
  for (let d = from; d <= to; d = addDays(d, 1)) byDay.set(d, { day: d, ...zero() });
  const byMethod = new Map(METHODS.map((m) => [m, { method: m, ...zero() }]));
  let urgent = 0;
  for (const r of rows) {
    const day = byDay.get(chisinauToday(new Date(r.createdAt)));
    if (!day) continue; // вне периода (граница суток по Кишинёву)
    add(total, r);
    add(day, r);
    const m = byMethod.get(r.method);
    if (m) add(m, r);
    if (r.stage === "done") add(done, r);
    if (r.urgent) urgent += 1;
  }
  return {
    from,
    to,
    ...total,
    avgCheck: total.orders ? Math.round(total.revenue / total.orders) : 0,
    urgent,
    done,
    days: [...byDay.values()],
    methods: [...byMethod.values()].filter((m) => m.orders > 0).sort((a, b) => b.orders - a.orders),
  };
}

export type Period = "today" | "7d" | "month" | "prev_month" | "custom";

export function periodRange(period: Period, now: Date, a?: string | null, b?: string | null): { from: string; to: string } | null {
  const today = chisinauToday(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (period) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "month":
      return { from: monthStart, to: today };
    case "prev_month": {
      const prevEnd = addDays(monthStart, -1);
      return { from: `${prevEnd.slice(0, 7)}-01`, to: prevEnd };
    }
    case "custom": {
      if (!isDay(a) || !isDay(b)) return null;
      const [from, to] = a <= b ? [a, b] : [b, a];
      if (addDays(from, MAX_REPORT_DAYS) < to) return null;
      return { from, to };
    }
  }
}
