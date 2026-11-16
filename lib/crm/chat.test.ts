import { test } from "node:test";
import assert from "node:assert/strict";
import { chatKeyboard, parseMoneyCallback, parseStageCallback, threadFor, topicRenames } from "./chat.ts";

const btns = (o: Parameters<typeof chatKeyboard>[0]) => chatKeyboard(o, "photobrelok_bot").flat().map((b) => b.text);

test("кнопки под заказом: следующий шаг, назад, CRM", () => {
  assert.deepEqual(btns({ code: "AAAAAA", stage: "new", method: "pickup" }), ["▶️ В производство", "📋 Открыть в CRM"]);
  assert.deepEqual(btns({ code: "AAAAAA", stage: "production", method: "pickup" }), ["🏪 Готов к выдаче", "↩️ Назад", "📋 Открыть в CRM"]);
  assert.deepEqual(btns({ code: "AAAAAA", stage: "production", method: "posta" }), ["📦 Готов к отправке", "↩️ Назад", "📋 Открыть в CRM"]);
  assert.deepEqual(btns({ code: "AAAAAA", stage: "ready", method: "posta" }), ["🏁 Отправлен — завершить", "↩️ Назад", "📋 Открыть в CRM"]);
  assert.deepEqual(btns({ code: "AAAAAA", stage: "ready", method: "pickup" }), ["🏁 Выдан — завершить", "↩️ Назад", "📋 Открыть в CRM"]);
  assert.deepEqual(btns({ code: "AAAAAA", stage: "done", method: "pickup" }), ["↩️ Вернуть в работу", "📋 Открыть в CRM"]);
  const kb = chatKeyboard({ code: "AAAAAA", stage: "new", method: "pickup" }, undefined);
  assert.deepEqual(kb, [[{ text: "▶️ В производство", callback_data: "st:AAAAAA:production" }]]); // без бота — без кнопки CRM
});

test("parseStageCallback", () => {
  assert.deepEqual(parseStageCallback("st:AAAAAA:production"), { code: "AAAAAA", stage: "production" });
  assert.equal(parseStageCallback("st:AAAAAA:cancelled"), null);
  assert.equal(parseStageCallback("st:aa:production"), null);
  assert.equal(parseStageCallback("done:AAAAAA"), null);
});

test("threadFor: тема по колонке; нет темы «Новые» — новые идут в «В работе»", () => {
  const t = { new: 20, production: 16, pickup: 17, ship: 18, done: 19 };
  assert.equal(threadFor({ stage: "new", method: "pickup" }, t), 20);
  assert.equal(threadFor({ stage: "ready", method: "novapost" }, t), 18);
  assert.equal(threadFor({ stage: "ready", method: "taxi" }, t), 17);
  assert.equal(threadFor({ stage: "new", method: "pickup" }, { ...t, new: undefined }), 16);
});

test("topicRenames: темы называются как стадии CRM; уже переименованные не трогаем", () => {
  const t = { new: 20, production: 16, pickup: 17, ship: 18, done: 19 };
  assert.deepEqual(topicRenames(t, {}), [
    { thread: 20, name: "🆕 Новые" },
    { thread: 16, name: "🛠 В производстве" },
    { thread: 17, name: "🏪 Готов к выдаче" },
    { thread: 18, name: "📦 Готов к отправке" },
    { thread: 19, name: "✅ Завершён" },
  ]);
  assert.deepEqual(topicRenames({ ...t, new: undefined }, { 16: "🛠 В производстве", 17: "Самовывоз" }), [
    { thread: 17, name: "🏪 Готов к выдаче" },
    { thread: 18, name: "📦 Готов к отправке" },
    { thread: 19, name: "✅ Завершён" },
  ]);
});

test("почта отправлена — кнопки денег; деньги пришли — только «Вернуть в работу»", () => {
  const sent = { code: "AAAAAA", stage: "done" as const, method: "posta" as const, moneyAt: null, returnedAt: null };
  assert.deepEqual(btns(sent), ["💰 Деньги получены", "↩️ Не забрали (возврат)", "↩️ Вернуть в работу", "📋 Открыть в CRM"]);
  assert.deepEqual(chatKeyboard(sent, undefined)[0][0], { text: "💰 Деньги получены", callback_data: "mn:AAAAAA:received" });
  assert.deepEqual(btns({ ...sent, moneyAt: "2026-11-16T10:00:00Z" }), ["↩️ Вернуть в работу", "📋 Открыть в CRM"]);
  assert.deepEqual(btns({ ...sent, returnedAt: "2026-11-16T10:00:00Z" }), ["💰 Деньги всё же получены", "↩️ Вернуть в работу", "📋 Открыть в CRM"]);
  assert.deepEqual(parseMoneyCallback("mn:AAAAAA:returned"), { code: "AAAAAA", money: "returned" });
  assert.equal(parseMoneyCallback("mn:AAAAAA:pending"), null);
});
