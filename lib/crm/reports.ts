// Отчёты CRM: заказы, брелки и суммы за период, по дням Кишинёва. Чистые функции — без базы.
import { addDays, chisinauToday, isDay } from "../delivery-dates.ts";
import type { DeliveryMethod } from "../order-fields.ts";
import { type Costs, type CrmOrder, METHODS, ZERO_COSTS, orderBoxes, orderCost, orderPrice } from "./model.ts";

export type ReportRow = Pick<
  CrmOrder,
  "createdAt" | "qty" | "urgent" | "price" | "stage" | "method" | "boxesSingle" | "boxesDouble" | "extraCost"
>;
type Totals = { orders: number; keychains: number; revenue: number; cost: number; profit: number };
export type ReportDay = Totals & { day: string };
export type Report = Totals & {
  from: string;
  to: string;
  avgCheck: number;
  urgent: number;
  boxesSingle: number;
  boxesDouble: number;
  costs: Costs;
  done: Totals;
  days: ReportDay[];
  methods: (Totals & { method: DeliveryMethod })[];
};

const zero = (): Totals => ({ orders: 0, keychains: 0, revenue: 0, cost: 0, profit: 0 });
function add(t: Totals, r: ReportRow, c: Costs): void {
  const price = orderPrice(r);
  const cost = orderCost(r, c);
  t.orders += 1;
  t.keychains += r.qty;
  t.revenue += price;
  t.cost += cost;
  t.profit += price - cost;
}

export const MAX_REPORT_DAYS = 400;

export function buildReport(rows: ReportRow[], from: string, to: string, costs: Costs = ZERO_COSTS): Report {
  const total = zero();
  const done = zero();
  const byDay = new Map<string, ReportDay>();
  for (let d = from; d <= to; d = addDays(d, 1)) byDay.set(d, { day: d, ...zero() });
  const byMethod = new Map(METHODS.map((m) => [m, { method: m, ...zero() }]));
  let urgent = 0;
  let boxesSingle = 0;
  let boxesDouble = 0;
  for (const r of rows) {
    const day = byDay.get(chisinauToday(new Date(r.createdAt)));
    if (!day) continue; // вне периода (граница суток по Кишинёву)
    add(total, r, costs);
    add(day, r, costs);
    const m = byMethod.get(r.method);
    if (m) add(m, r, costs);
    if (r.stage === "done") add(done, r, costs);
    if (r.urgent) urgent += 1;
    const b = orderBoxes(r);
    boxesSingle += b.single;
    boxesDouble += b.double;
  }
  return {
    from,
    to,
    ...total,
    avgCheck: total.orders ? Math.round(total.revenue / total.orders) : 0,
    urgent,
    boxesSingle,
    boxesDouble,
    costs,
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
