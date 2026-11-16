import { test } from "node:test";
import assert from "node:assert/strict";
import { chatKeyboard, parseStageCallback, threadFor } from "./chat.ts";

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
