import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExpense } from "./expenses.ts";

test("parseExpense: дата, сумма, комментарий", () => {
  assert.deepEqual(parseExpense({ day: "2026-11-05", amount: 300, note: "  Реклама\nInstagram " }), {
    ok: true,
    value: { day: "2026-11-05", amount: 300, note: "Реклама Instagram" },
  });
  assert.equal(parseExpense({ day: "05.11", amount: 300 }).ok, false);
  assert.equal(parseExpense({ day: "2026-11-05", amount: -1 }).ok, false);
  assert.equal(parseExpense({ day: "2026-11-05", amount: 1.5 }).ok, false);
  assert.equal(parseExpense(null).ok, false);
  // частичная правка
  assert.deepEqual(parseExpense({ amount: 0 }, true), { ok: true, value: { amount: 0 } });
  assert.equal(parseExpense({}, true).ok, false);
});
