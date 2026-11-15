import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, periodRange, type ReportRow } from "./reports.ts";

const row = (createdAt: string, extra: Partial<ReportRow> = {}): ReportRow => ({
  createdAt,
  qty: 1,
  urgent: false,
  price: null,
  stage: "new",
  method: "pickup",
  boxesSingle: null,
  boxesDouble: null,
  extraCost: null,
  ...extra,
});

test("buildReport считает заказы, брелки и сумму по дням Кишинёва", () => {
  const r = buildReport(
    [
      row("2026-11-01T10:00:00Z", { qty: 2 }), // 250+150
      row("2026-11-01T22:30:00Z", { urgent: true }), // в Кишинёве уже 2 ноября: 250+100
      row("2026-11-03T08:00:00Z", { price: 500, qty: 3, stage: "done", method: "posta" }),
      row("2026-10-31T21:59:00Z"), // 31.10 23:59 по Кишинёву — вне периода
    ],
    "2026-11-01",
    "2026-11-03",
  );
  assert.equal(r.orders, 3);
  assert.equal(r.keychains, 6);
  assert.equal(r.revenue, 400 + 350 + 500);
  assert.equal(r.avgCheck, Math.round(1250 / 3));
  assert.equal(r.done.orders, 1);
  assert.equal(r.done.revenue, 500);
  assert.equal(r.urgent, 1);
  assert.deepEqual(
    r.days.map((d) => [d.day, d.orders, d.keychains, d.revenue]),
    [
      ["2026-11-01", 1, 2, 400],
      ["2026-11-02", 1, 1, 350],
      ["2026-11-03", 1, 3, 500],
    ],
  );
  assert.deepEqual(r.methods.find((m) => m.method === "posta"), { method: "posta", orders: 1, keychains: 3, revenue: 500, cost: 0, profit: 500 });
});

test("buildReport: пустой период — нули и дни без заказов", () => {
  const r = buildReport([], "2026-11-01", "2026-11-02");
  assert.equal(r.orders, 0);
  assert.equal(r.avgCheck, 0);
  assert.equal(r.days.length, 2);
});

test("periodRange: пресеты и проверка своего периода", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  assert.deepEqual(periodRange("today", now), { from: "2026-11-15", to: "2026-11-15" });
  assert.deepEqual(periodRange("7d", now), { from: "2026-11-09", to: "2026-11-15" });
  assert.deepEqual(periodRange("month", now), { from: "2026-11-01", to: "2026-11-15" });
  assert.deepEqual(periodRange("prev_month", now), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(periodRange("custom", now, "2026-10-05", "2026-10-01"), { from: "2026-10-01", to: "2026-10-05" });
  assert.equal(periodRange("custom", now, "bad", "2026-10-01"), null);
  assert.equal(periodRange("custom", now, "2020-01-01", "2026-10-01"), null); // больше 400 дней
});

test("buildReport: себестоимость, коробки и чистая прибыль", () => {
  const costs = { keychain: 60, boxSingle: 15, boxDouble: 30 };
  const r = buildReport(
    [
      row("2026-11-01T10:00:00Z", { qty: 2 }), // 400 − (120 + 30) = 250
      row("2026-11-01T11:00:00Z", { qty: 3, stage: "done", extraCost: 20 }), // 550 − (180 + 45 + 20) = 305
    ],
    "2026-11-01",
    "2026-11-01",
    costs,
  );
  assert.equal(r.revenue, 950);
  assert.equal(r.cost, 150 + 245);
  assert.equal(r.profit, 250 + 305);
  assert.equal(r.boxesSingle, 3);
  assert.equal(r.boxesDouble, 1);
  assert.equal(r.done.profit, 305);
  assert.equal(r.days[0].profit, 555);
  assert.deepEqual(r.costs, costs);
});
