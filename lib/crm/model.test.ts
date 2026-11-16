import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type CrmOrder,
  applyPatch,
  columnLabel,
  columnOf,
  nextStage,
  orderBoxes,
  orderCost,
  amountDue,
  moneyState,
  orderPrice,
  orderToRow,
  prevStage,
  rowToOrder,
  sortOrders,
  stageLabel,
  stageOfColumn,
  toFields,
} from "./model.ts";

const now = new Date("2026-11-16T10:00:00Z"); // пн, 12:00 Кишинёв

function order(p: Partial<CrmOrder> = {}): CrmOrder {
  return {
    code: "ABC234", createdAt: "2026-11-15T10:00:00Z", stage: "new", stageChangedAt: "2026-11-15T10:00:00Z",
    name: "Мария", phone: "+373 60 024 571", wantedDate: null, urgent: false, method: "pickup",
    postalCode: null, city: null, district: null, street: null, branch: null, address: null,
    qty: 1, price: null, lang: "ru", source: null, pdfPath: null, tgChatId: null, tgMessageId: null, tgCaption: null,
    flags: [], commentsCount: 0, boxes: null, extraCost: null, paid: false, deletedAt: null, tgThreadId: null, moneyAt: null, returnedAt: null, ...p,
  };
}

test("labels and columns", () => {
  assert.equal(stageLabel("ready", "posta"), "📦 Готов к отправке");
  assert.equal(stageLabel("ready", "novapost"), "📦 Готов к отправке");
  assert.equal(stageLabel("ready", "pickup"), "🏪 Готов к выдаче");
  assert.equal(columnOf({ stage: "ready", method: "taxi" }), "pickup");
  assert.equal(columnOf({ stage: "ready", method: "later" }), "pickup");
  assert.equal(columnOf({ stage: "production", method: "posta" }), "production");
  assert.equal(stageOfColumn("ship"), "ready");
  assert.equal(columnLabel("new"), "🆕 Новые");
  assert.equal(columnLabel("done"), "✅ Завершён");
  assert.equal(nextStage("production"), "ready");
  assert.equal(nextStage("done"), null);
  assert.equal(prevStage("new"), null);
});
test("price", () => {
  assert.equal(orderPrice({ qty: 1, urgent: false, price: null }), 250);
  assert.equal(orderPrice({ qty: 3, urgent: true, price: null }), 650);
  assert.equal(orderPrice({ qty: 3, urgent: false, price: 600 }), 600);
});
test("sort: urgent, then nearest date, no date last, then oldest first", () => {
  const list = [
    order({ code: "NODATE", createdAt: "2026-11-10T00:00:00Z" }),
    order({ code: "LATER2", wantedDate: "2026-11-20" }),
    order({ code: "SOON22", wantedDate: "2026-11-17" }),
    order({ code: "URGENT", urgent: true, wantedDate: "2026-11-16" }),
    order({ code: "NODAT2", createdAt: "2026-11-12T00:00:00Z" }),
  ];
  assert.deepEqual(sortOrders(list).map((o) => o.code), ["URGENT", "SOON22", "LATER2", "NODATE", "NODAT2"]);
});
test("patch touches only given fields and lists changes", () => {
  const r = applyPatch(order(), { phone: "069708505" }, now);
  assert.ok(r.ok);
  assert.equal(r.next.phone, "+373 69 708 505");
  assert.equal(r.next.name, "Мария");
  assert.deepEqual(r.changed, ["phone"]);
});
test("patch errors", () => {
  const err = (p: Parameters<typeof applyPatch>[1], base = order()) => (applyPatch(base, p, now) as { error: string }).error;
  assert.equal(err({ phone: "123" }), "Проверьте номер телефона");
  assert.equal(err({ method: "posta" }), "Для почты нужны: индекс, город, район");
  assert.equal(err({ method: "novapost" }), "Для Nova Poshta нужен номер отделения");
  assert.equal(err({ method: "taxi" }), "Для такси нужен адрес");
  assert.equal(err({ urgent: true, method: "posta", postalCode: "2001", city: "Кишинёв", district: "Кишинёв" }), "Срочно — только самовывоз или такси");
  assert.equal(err({ qty: 0 }), "Количество — от 1 до 20");
  assert.equal(err({ qty: 21 }), "Количество — от 1 до 20");
  assert.equal(err({ name: "  " }), "Имя не может быть пустым");
  assert.equal(err({ wantedDate: "16.11" }), "Неверная дата");
  assert.equal(err({ price: -5 }), "Цена не может быть отрицательной");
});
test("patch warns on early date but saves", () => {
  const r = applyPatch(order({ method: "posta", postalCode: "2001", city: "Кишинёв", district: "Кишинёв" }), { wantedDate: "2026-11-16" }, now);
  assert.ok(r.ok);
  assert.equal(r.next.wantedDate, "2026-11-16");
  assert.deepEqual(r.warnings, ["Дата раньше ближайшей для почты"]);
});
test("method change clears other method fields and moves ready order between columns", () => {
  const base = order({ stage: "ready", method: "taxi", address: "Колумна 5" });
  const r = applyPatch(base, { method: "posta", postalCode: "3300", city: "Тирасполь", district: "Тирасполь" }, now);
  assert.ok(r.ok);
  assert.equal(r.next.address, null);
  assert.equal(r.next.stage, "ready");
  assert.equal(columnOf(r.next), "ship");
  assert.deepEqual(r.changed.sort(), ["address", "city", "district", "method", "postalCode"]);
});
test("stage change", () => {
  const r = applyPatch(order(), { stage: "production" }, now);
  assert.ok(r.ok);
  assert.deepEqual(r.changed, ["stage"]);
  assert.equal((applyPatch(order(), { stage: "lost" as never }, now) as { error: string }).error, "Неизвестная стадия");
});
test("toFields", () => {
  const f = toFields(order({ method: "posta", postalCode: "3300", city: "Тирасполь", district: "Тирасполь", wantedDate: "2026-11-21" }));
  assert.equal(f.postalCode, "3300");
  assert.equal(f.wantedDate, "2026-11-21");
  assert.equal(f.address, undefined);
});
test("row mapping round-trips", () => {
  const o = order({ wantedDate: "2026-11-21", tgChatId: -1004393765609, flags: ["imported"] });
  const row: Record<string, unknown> = { ...orderToRow(o), comments_count: 0 };
  assert.equal(row.wanted_date, "2026-11-21");
  assert.equal(row.tg_chat_id, -1004393765609);
  assert.deepEqual(rowToOrder(row), o);
});

test("orderBoxes: 1 → 1, 2 одинаковых → 1, 3+ → каждому; ручное число важнее", () => {
  assert.deepEqual(orderBoxes(order({ qty: 1 })), { count: 1, auto: true });
  assert.deepEqual(orderBoxes(order({ qty: 2 })), { count: 1, auto: true });
  assert.deepEqual(orderBoxes(order({ qty: 3 })), { count: 3, auto: true });
  assert.deepEqual(orderBoxes(order({ qty: 2, boxes: 2 })), { count: 2, auto: false }); // 2 разных брелка
  assert.deepEqual(orderBoxes(order({ qty: 3, boxes: 0 })), { count: 0, auto: false });
});

test("orderCost: брелки + коробки + доп. расходы", () => {
  const costs = { keychain: 60, box: 20 };
  assert.equal(orderCost(order({ qty: 1 }), costs), 60 + 20);
  assert.equal(orderCost(order({ qty: 2 }), costs), 120 + 20);
  assert.equal(orderCost(order({ qty: 3, extraCost: 40 }), costs), 180 + 60 + 40);
});

test("applyPatch: коробки и доп. расходы", () => {
  const r = applyPatch(order({ qty: 2 }), { boxes: 2, extraCost: 25 }, now);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.next.boxes, 2);
    assert.equal(r.next.extraCost, 25);
    assert.deepEqual(r.changed.sort(), ["boxes", "extraCost"]);
  }
  const back = applyPatch(order({ boxes: 2 }), { boxes: null }, now);
  assert.ok(back.ok && back.next.boxes === null);
  assert.equal(applyPatch(order(), { boxes: -1 }, now).ok, false);
  assert.equal(applyPatch(order(), { extraCost: 1.5 }, now).ok, false);
});

test("rowToOrder/orderToRow: новые поля", () => {
  const o = rowToOrder({ code: "X", boxes: 2, extra_cost: 10 });
  assert.equal(o.boxes, 2);
  assert.equal(o.extraCost, 10);
  assert.deepEqual(orderToRow({ boxes: 1, extraCost: null }), { boxes: 1, extra_cost: null });
});

test("applyPatch/rowToOrder: оплачен", () => {
  const r = applyPatch(order(), { paid: true }, now);
  assert.ok(r.ok && r.next.paid === true && r.changed.includes("paid"));
  assert.equal(rowToOrder({ code: "X", paid: true }).paid, true);
  assert.equal(rowToOrder({ code: "X" }).paid, false);
  assert.deepEqual(orderToRow({ paid: true }), { paid: true });
});

test("amountDue: почтой Молдовы +30 лей за доставку, остальные — цена заказа", () => {
  assert.equal(amountDue(order({ method: "posta", qty: 2 })), 430);
  assert.equal(amountDue(order({ method: "posta", qty: 1 })), 280);
  assert.equal(amountDue(order({ method: "posta", price: 500 })), 530);
  assert.equal(amountDue(order({ method: "pickup", qty: 2 })), 400);
  assert.equal(amountDue(order({ method: "novapost" })), 250);
});

test("rowToOrder/orderToRow: удалён из CRM", () => {
  assert.equal(rowToOrder({ code: "X" }).deletedAt, null);
  assert.equal(rowToOrder({ code: "X", deleted_at: "2026-11-16T10:00:00Z" }).deletedAt, "2026-11-16T10:00:00Z");
  assert.deepEqual(orderToRow({ deletedAt: "2026-11-16T10:00:00Z" }), { deleted_at: "2026-11-16T10:00:00Z" });
});

const later = new Date("2026-11-17T10:00:00Z");

test("деньги: самовывоз/такси — получены при выдаче (завершён)", () => {
  const r = applyPatch(order({ stage: "ready", method: "pickup" }), { stage: "done" }, later);
  assert.ok(r.ok && r.next.moneyAt === later.toISOString() && moneyState(r.next) === "received");
  assert.ok(r.ok && r.changed.includes("moneyAt"));
});

test("деньги: почта — после «Отправлен» ждём деньги; потом «получены» или «возврат»", () => {
  const post = { method: "posta" as const, postalCode: "MD-2001", city: "C", district: "C" };
  const sent = applyPatch(order({ stage: "ready", ...post }), { stage: "done" }, later);
  assert.ok(sent.ok && sent.next.moneyAt === null && moneyState(sent.next) === "pending");
  if (!sent.ok) return;
  const got = applyPatch(sent.next, { money: "received" }, later);
  assert.ok(got.ok && got.next.moneyAt === later.toISOString() && moneyState(got.next) === "received");
  const back = applyPatch(sent.next, { money: "returned" }, later);
  assert.ok(back.ok && back.next.returnedAt === later.toISOString() && back.next.moneyAt === null && moneyState(back.next) === "returned");
  assert.equal(applyPatch(order({ stage: "done", method: "pickup" }), { money: "returned" }, later).ok, false); // возврат — только почта
});

test("деньги: предоплата на карту — получены сразу; вернули заказ из «Завершён» — снова не оплачен", () => {
  const paid = applyPatch(order(), { paid: true }, later);
  assert.ok(paid.ok && paid.next.moneyAt === later.toISOString());
  const reopened = applyPatch(order({ stage: "done", moneyAt: "2026-11-16T10:00:00Z" }), { stage: "production" }, later);
  assert.ok(reopened.ok && reopened.next.moneyAt === null);
  const reopenedPaid = applyPatch(order({ stage: "done", paid: true, moneyAt: "2026-11-16T10:00:00Z" }), { stage: "production" }, later);
  assert.ok(reopenedPaid.ok && reopenedPaid.next.moneyAt === "2026-11-16T10:00:00Z"); // предоплата остаётся
  assert.equal(moneyState(order({ stage: "production" })), "none");
});
