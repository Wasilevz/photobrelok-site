// Отчёты CRM. Чистые функции — без базы.
// «Пришло» — заказы по дню оформления. «Прибыль» — только заказы, деньги за которые реально получены
// (предоплата, выдача, деньги с почты), по дню получения; минус возвраты (посылку не забрали — потеряли
// брелки и коробки) и расходы бизнеса за период (реклама и т. п.). «Ждём деньги» — отправленные почтой без оплаты.
import { addDays, chisinauToday, isDay } from "../delivery-dates.ts";
import type { DeliveryMethod } from "../order-fields.ts";
import { type Costs, type CrmOrder, METHODS, ZERO_COSTS, moneyState, orderBoxes, orderCost, orderPrice } from "./model.ts";

export type ReportRow = Pick<
  CrmOrder,
  "code" | "createdAt" | "stageChangedAt" | "qty" | "urgent" | "price" | "stage" | "method" | "boxes" | "extraCost" | "moneyAt" | "returnedAt"
>;
export type ExpenseRow = { day: string; amount: number };

type Totals = { orders: number; keychains: number; revenue: number };
export type ReportDay = Totals & { day: string };
export type Profit = Totals & {
  boxes: number;
  keychainCost: number;
  boxCost: number;
  extraCost: number;
  expenses: number;
  profit: number;
};
export type Report = Totals & {
  from: string;
  to: string;
  avgCheck: number;
  urgent: number;
  days: ReportDay[];
  methods: (Totals & { method: DeliveryMethod })[];
  done: Profit;
  returned: { orders: number; keychains: number; loss: number };
  pending: { orders: number; amount: number };
  costs: Costs;
};

const zero = (): Totals => ({ orders: 0, keychains: 0, revenue: 0 });
function add(t: Totals, r: ReportRow): void {
  t.orders += 1;
  t.keychains += r.qty;
  t.revenue += orderPrice(r);
}
const dayOf = (iso: string) => chisinauToday(new Date(iso));

export const MAX_REPORT_DAYS = 400;

export function buildReport(
  rows: ReportRow[],
  from: string,
  to: string,
  costs: Costs = ZERO_COSTS,
  expenses: ExpenseRow[] = [],
): Report {
  const inPeriod = (day: string) => day >= from && day <= to;
  const total = zero();
  const byDay = new Map<string, ReportDay>();
  for (let d = from; d <= to; d = addDays(d, 1)) byDay.set(d, { day: d, ...zero() });
  const byMethod = new Map(METHODS.map((m) => [m, { method: m, ...zero() }]));
  let urgent = 0;
  const done: Profit = { ...zero(), boxes: 0, keychainCost: 0, boxCost: 0, extraCost: 0, expenses: 0, profit: 0 };
  const returned = { orders: 0, keychains: 0, loss: 0 };
  const pending = { orders: 0, amount: 0 };

  for (const r of rows) {
    const day = byDay.get(dayOf(r.createdAt));
    if (day) {
      add(total, r);
      add(day, r);
      const m = byMethod.get(r.method);
      if (m) add(m, r);
      if (r.urgent) urgent += 1;
    }
    const state = moneyState(r);
    if (state === "pending") {
      pending.orders += 1;
      pending.amount += orderPrice(r);
    }
    if (state === "returned" && inPeriod(dayOf(r.returnedAt as string))) {
      returned.orders += 1;
      returned.keychains += r.qty;
      returned.loss += orderCost(r, costs);
    }
    if (state === "received" && inPeriod(dayOf(r.moneyAt as string))) {
      add(done, r);
      const boxes = orderBoxes(r).count;
      done.boxes += boxes;
      done.keychainCost += r.qty * costs.keychain;
      done.boxCost += boxes * costs.box;
      done.extraCost += r.extraCost ?? 0;
    }
  }
  done.expenses = expenses.filter((e) => inPeriod(e.day)).reduce((s, e) => s + e.amount, 0);
  done.profit = done.revenue - done.keychainCost - done.boxCost - done.extraCost - done.expenses - returned.loss;

  return {
    from,
    to,
    ...total,
    avgCheck: total.orders ? Math.round(total.revenue / total.orders) : 0,
    urgent,
    days: [...byDay.values()],
    methods: [...byMethod.values()].filter((m) => m.orders > 0).sort((a, b) => b.orders - a.orders),
    done,
    returned,
    pending,
    costs,
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
