import { test } from "node:test";
import assert from "node:assert/strict";
import { morningSummary } from "./morning.ts";
import type { CrmOrder } from "./model.ts";

// Вторник 17.11.2026, 08:00 по Кишинёву.
const NOW = new Date("2026-11-17T06:00:00Z");

let n = 0;
function order(p: Partial<CrmOrder>): CrmOrder {
  n++;
  return {
    code: `AAAA${String(n).padStart(2, "0")}`, createdAt: "2026-11-10T08:00:00Z", stage: "production", stageChangedAt: "2026-11-15T08:00:00Z",
    name: `Клиент ${n}`, phone: "+373 60 000 000", wantedDate: null, urgent: false, method: "pickup", postalCode: null, city: null, district: null,
    street: null, branch: null, address: null, qty: 1, price: null, lang: "ru", source: null, pdfPath: null, tgChatId: null, tgMessageId: null,
    tgCaption: null, tgThreadId: null, moneyAt: null, returnedAt: null, flags: [], commentsCount: 0, boxes: null, extraCost: null, paid: false,
    deletedAt: null, track: null, ...p,
  };
}

test("сводка: просрочено, выдать сегодня, отправить сегодня, на завтра, ждём деньги", () => {
  const list = [
    order({ name: "Мария", wantedDate: "2026-11-16" }), // самовывоз вчера — просрочен
    order({ name: "Ион", wantedDate: "2026-11-17", stage: "ready", qty: 2 }), // выдать сегодня
    order({ name: "Анна", wantedDate: "2026-11-20", method: "posta" }), // отправить до 17.11 (20 − 3)
    order({ name: "Пётр", wantedDate: "2026-11-18", urgent: true, paid: true }), // на завтра
    order({ name: "Ольга", stage: "done", method: "posta", stageChangedAt: "2026-11-01T10:00:00Z", track: "RR123456789MD" }), // ждём деньги 16 дней
    order({ name: "Свежая почта", stage: "done", method: "posta", stageChangedAt: "2026-11-14T10:00:00Z" }), // ждём 3 дня — рано
    order({ name: "Завершён", stage: "done", wantedDate: "2026-11-10", moneyAt: "2026-11-10T10:00:00Z" }), // не в сводке
    order({ name: "Без даты" }), // не в сводке
    order({ name: "Позже", wantedDate: "2026-11-25" }), // не в сводке
  ];
  const text = morningSummary(list, NOW);
  assert.equal(
    text,
    [
      "☀️ Доброе утро! Заказы на вт 17.11",
      "",
      "🔴 Просрочено — 1:",
      "• #AAAA01 Мария · 🏪 выдать пн 16.11 · 🛠 В производстве",
      "",
      "🏪 Выдать сегодня — 1:",
      "• #AAAA02 Ион · 2 шт. · 🏪 Готов к выдаче",
      "",
      "📦 Отправить сегодня — 1:",
      "• #AAAA03 Анна · получить пт 20.11 · 🛠 В производстве",
      "",
      "📅 Завтра — 1:",
      "• #AAAA04 Пётр · ⚡ срочно · 💳 оплачен · 🛠 В производстве",
      "",
      "💰 Ждём деньги с почты больше 10 дней — 1:",
      "• #AAAA05 Ольга · отправлен вс 01.11 · трек RR123456789MD",
    ].join("\n"),
  );
});

test("сводка: дел нет — короткое сообщение", () => {
  assert.equal(morningSummary([order({ wantedDate: "2026-11-30" })], NOW), "☀️ Доброе утро! Заказы на вт 17.11\n\nНа сегодня и завтра сроков нет 👍");
});

test("сводка: почта, у которой срок отправки прошёл, — в просроченных", () => {
  const text = morningSummary([order({ name: "Опоздали", method: "novapost", wantedDate: "2026-11-19", stage: "ready" })], NOW);
  assert.match(text, /🔴 Просрочено — 1:\n• #AAAA\d\d Опоздали · 📦 отправить пн 16.11 · 📦 Готов к отправке/);
});

test("сводка: длинный список обрезается, сообщение влезает в Telegram", () => {
  const many = Array.from({ length: 80 }, () => order({ wantedDate: "2026-11-17", name: "Очень длинное имя клиента для проверки длины" }));
  const text = morningSummary(many, NOW);
  assert.ok(text.length < 4000);
  assert.match(text, /…и ещё \d+/);
});
