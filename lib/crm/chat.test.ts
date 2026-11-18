import { test } from "node:test";
import assert from "node:assert/strict";
import { actualThread, chatKeyboard, moveMessage, quickAction, parseMoneyCallback, parseStageCallback, stepLabel, threadFor, topicRenames } from "./chat.ts";

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

test("moveMessage: копия → старое удалено → заказ в новом сообщении", async () => {
  const log: string[] = [];
  const id = await moveMessage({
    copy: async () => (log.push("copy"), 77),
    deleteOld: async () => void log.push("deleteOld"),
    deleteCopy: async (m) => void log.push(`deleteCopy ${m}`),
  });
  assert.equal(id, 77);
  assert.deepEqual(log, ["copy", "deleteOld"]);
});

test("moveMessage: старое не удаляется (старше 48 ч) — копия убирается, дубля нет", async () => {
  const log: string[] = [];
  const id = await moveMessage({
    copy: async () => (log.push("copy"), 77),
    deleteOld: async () => {
      throw new Error("Bad Request: message can't be deleted");
    },
    deleteCopy: async (m) => void log.push(`deleteCopy ${m}`),
  });
  assert.equal(id, null); // заказ остаётся в прежнем сообщении
  assert.deepEqual(log, ["copy", "deleteCopy 77"]);
});

test("moveMessage: копия не получилась — ничего не удаляется", async () => {
  const log: string[] = [];
  const id = await moveMessage({
    copy: async () => {
      throw new Error("Bad Request: message to copy not found");
    },
    deleteOld: async () => void log.push("deleteOld"),
    deleteCopy: async (m) => void log.push(`deleteCopy ${m}`),
  });
  assert.equal(id, null);
  assert.deepEqual(log, []);
});

test("moveMessage: старого уже нет в чате — считаем перенос удачным", async () => {
  const id = await moveMessage({
    copy: async () => 78,
    deleteOld: async () => {
      throw new Error("Bad Request: message to delete not found");
    },
    deleteCopy: async () => assert.fail("копию трогать нельзя"),
  });
  assert.equal(id, 78);
});

test("stepLabel: подписи шага одинаковые в чате и в CRM", () => {
  assert.equal(stepLabel({ stage: "new", method: "pickup" }, "production"), "▶️ В производство");
  assert.equal(stepLabel({ stage: "production", method: "taxi" }, "ready"), "🏪 Готов к выдаче");
  assert.equal(stepLabel({ stage: "ready", method: "posta" }, "done"), "🏁 Отправлен — завершить");
  assert.equal(stepLabel({ stage: "done", method: "posta" }, "production"), "↩️ Вернуть в работу");
});

test("quickAction: шаг вперёд; у отправленного почтой — «деньги получены»; у завершённого — ничего", () => {
  const base = { moneyAt: null, returnedAt: null };
  assert.deepEqual(quickAction({ ...base, stage: "new", method: "pickup" }), {
    label: "▶️ В производство", patch: { stage: "production" }, undo: { stage: "new" }, done: "🛠 В производстве",
  });
  assert.equal(quickAction({ ...base, stage: "ready", method: "posta" })?.done, "✅ Завершён");
  assert.deepEqual(quickAction({ ...base, stage: "done", method: "posta" })?.patch, { money: "received" });
  assert.equal(quickAction({ ...base, stage: "done", method: "posta", moneyAt: "2026-11-16T10:00:00Z" }), null);
  assert.equal(quickAction({ ...base, stage: "done", method: "pickup", moneyAt: "2026-11-16T10:00:00Z" }), null);
});

test("moveMessage с onStuck (разовая починка чата): старое не удалилось — копия остаётся, старое помечается, дубль не удаляется молча", async () => {
  const log: string[] = [];
  const id = await moveMessage({
    copy: async () => (log.push("copy"), 77),
    deleteOld: async () => {
      throw new Error("Bad Request: message can't be deleted");
    },
    deleteCopy: async () => void log.push("deleteCopy"),
    onStuck: async () => void log.push("onStuck"),
  });
  assert.equal(id, 77);
  assert.deepEqual(log, ["copy", "onStuck"]);
});

test("actualThread: тема из ответа Telegram; без номера (общая тема) — 1; нет ответа — неизвестно", () => {
  assert.equal(actualThread({ message_thread_id: 17 }), 17);
  assert.equal(actualThread({}), 1);
  assert.equal(actualThread(null), null);
  assert.equal(actualThread(true), null); // Telegram вернул true, а не сообщение
});
