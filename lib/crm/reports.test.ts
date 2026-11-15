import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, periodRange, type ReportRow } from "./reports.ts";

const row = (createdAt: string, extra: Partial<ReportRow> = {}): ReportRow => ({
  code: createdAt,
  createdAt,
  stageChangedAt: createdAt,
  qty: 1,
  urgent: false,
  price: null,
  stage: "new",
  method: "pickup",
  boxes: null,
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
  assert.equal(r.done.profit, 500); // себестоимость не задана
  assert.equal(r.urgent, 1);
  assert.deepEqual(
    r.days.map((d) => [d.day, d.orders, d.keychains, d.revenue]),
    [
      ["2026-11-01", 1, 2, 400],
      ["2026-11-02", 1, 1, 350],
      ["2026-11-03", 1, 3, 500],
    ],
  );
  assert.deepEqual(r.methods.find((m) => m.method === "posta"), { method: "posta", orders: 1, keychains: 3, revenue: 500 });
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

test("buildReport: прибыль — только завершённые, по дню завершения, минус расходы периода", () => {
  const costs = { keychain: 60, box: 20 };
  const r = buildReport(
    [
      // пришёл в октябре, завершён 2 ноября: в прибыли ноября, в «пришло» — нет
      row("2026-10-30T10:00:00Z", { qty: 2, stage: "done", stageChangedAt: "2026-11-02T10:00:00Z" }), // 400 − 120 − 20 = 260
      // 3 одинаковых, каждый в своей коробке + доп. расходы
      row("2026-11-01T11:00:00Z", { qty: 3, stage: "done", stageChangedAt: "2026-11-03T10:00:00Z", extraCost: 20 }), // 550 − 180 − 60 − 20 = 290
      // 2 разных брелка без скидки: 2 коробки, цена вручную
      row("2026-11-01T12:00:00Z", { qty: 2, boxes: 2, price: 500, stage: "done", stageChangedAt: "2026-11-01T15:00:00Z" }), // 500 − 120 − 40 = 340
      // не завершён — в прибыль не идёт
      row("2026-11-02T12:00:00Z", { qty: 1, stage: "production" }),
      // завершён после периода
      row("2026-11-02T13:00:00Z", { qty: 1, stage: "done", stageChangedAt: "2026-12-01T10:00:00Z" }),
    ],
    "2026-11-01",
    "2026-11-30",
    costs,
    [
      { day: "2026-11-05", amount: 300 }, // реклама
      { day: "2026-10-31", amount: 999 }, // вне периода
    ],
  );
  assert.equal(r.orders, 4); // пришли в ноябре
  assert.equal(r.done.orders, 3);
  assert.equal(r.done.keychains, 7);
  assert.equal(r.done.revenue, 1450);
  assert.equal(r.done.boxes, 1 + 3 + 2);
  assert.equal(r.done.keychainCost, 420);
  assert.equal(r.done.boxCost, 120);
  assert.equal(r.done.extraCost, 20);
  assert.equal(r.done.expenses, 300);
  assert.equal(r.done.profit, 260 + 290 + 340 - 300);
  assert.deepEqual(r.costs, costs);
});
