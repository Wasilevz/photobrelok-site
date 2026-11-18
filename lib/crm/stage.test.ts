// Сквозная проверка: правка заказа → база → чат производства. База (Supabase REST) и Telegram заменены
// локальным сервером-макетом: настоящие запросы уходят на 127.0.0.1, наружу — ничего.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { type CrmOrder, orderToRow } from "./model.ts";

const CHAT = -1001234567890;
const TOPICS = { new: 148, work: 16, pickup: 17, ship: 18, done: 19 };

let row: Record<string, unknown> = {};
let history: { action: string; details: Record<string, unknown> }[] = [];
let calls: { method: string; body: Record<string, unknown> }[] = [];
let failDelete = new Set<number>(); // сообщения, которые Telegram «не даёт удалить» (старше 48 часов)
let nextMessageId = 500;
let editThread: number | undefined = 16; // в какой теме на самом деле лежит сообщение (ответ на editMessageCaption)
let messageThreads: Record<number, number> = {}; // тема отдельных сообщений (перекрывает editThread)
let rows: Record<string, Record<string, unknown>> = {}; // несколько заказов сразу (починка чата); иначе — один row

function order(patch: Partial<CrmOrder>): CrmOrder {
  return {
    code: "AAAAAA", createdAt: "2026-11-10T08:00:00.000Z", stage: "new", stageChangedAt: new Date().toISOString(), name: "Ион", phone: "+373 60 000 000",
    wantedDate: null, urgent: false, method: "pickup", postalCode: null, city: null, district: null, street: null, branch: null, address: null,
    qty: 1, price: null, lang: "ru", source: null, pdfPath: "AAAAAA.pdf", tgChatId: CHAT, tgMessageId: 100, tgCaption: "🔥 Новый заказ #AAAAAA\n👤 Клиент: Ион\n📞 Тел: +373 60 000 000",
    tgThreadId: TOPICS.new, moneyAt: null, returnedAt: null, flags: [], commentsCount: 0, boxes: null, extraCost: null, paid: false, deletedAt: null, track: null,
    ...patch,
  };
}

const server = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    const url = new URL(req.url ?? "/", "http://x");
    const json = (data: unknown, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    const tgMethod = /^\/botTEST\/(\w+)$/.exec(url.pathname)?.[1];
    if (tgMethod) {
      calls.push({ method: tgMethod, body });
      if (tgMethod === "deleteMessage" && failDelete.has(body.message_id)) return json({ ok: false, description: "Bad Request: message can't be deleted" }, 400);
      if (tgMethod === "editMessageCaption") {
        const thread = messageThreads[body.message_id] ?? editThread;
        return json({ ok: true, result: { message_id: body.message_id, ...(thread ? { message_thread_id: thread } : {}) } });
      }
      return json({ ok: true, result: tgMethod === "copyMessage" ? { message_id: nextMessageId++ } : true });
    }
    const code = /^eq\.(\w+)$/.exec(url.searchParams.get("code") ?? "")?.[1];
    if (url.pathname === "/rest/v1/crm_orders" && req.method === "GET") return json((code && rows[code]) || row);
    if (url.pathname === "/rest/v1/crm_orders" && req.method === "PATCH") {
      Object.assign((code && rows[code]) || row, body);
      return json(null, 204);
    }
    if (url.pathname === "/rest/v1/crm_history" && req.method === "POST") {
      history.push(...(body as typeof history));
      return json(null, 201);
    }
    if (url.pathname === "/rest/v1/crm_settings") {
      const key = url.searchParams.get("key");
      if (key === "eq.topics") return json({ value: { new: TOPICS.new } });
      if (key === "eq.topic_names") {
        return json({ value: { 148: "🆕 Новые", 16: "🛠 В производстве", 17: "🏪 Готов к выдаче", 18: "📦 Готов к отправке", 19: "✅ Завершён" } });
      }
    }
    json({ message: `нет в макете: ${req.method} ${req.url}` }, 500);
  });
});

let changeOrder: typeof import("./stage.ts").changeOrder;
const actor = { id: 1, name: "Тест" };

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  Object.assign(process.env, {
    SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: "test", TELEGRAM_API_BASE: base, TELEGRAM_BOT_TOKEN: "TEST", TELEGRAM_BOT_USERNAME: "photobrelok_bot",
    TELEGRAM_CHAT_ID: String(CHAT), TELEGRAM_TOPIC_WORK: "16", TELEGRAM_TOPIC_PICKUP: "17", TELEGRAM_TOPIC_SHIP: "18", TELEGRAM_TOPIC_DONE: "19",
  });
  ({ changeOrder } = await import("./stage.ts"));
});
after(() => server.close());
beforeEach(() => {
  history = [];
  calls = [];
  failDelete = new Set();
  nextMessageId = 500;
  editThread = 16;
  messageThreads = {};
  rows = {};
});

const set = (o: CrmOrder) => (row = { id: "id-1", ...orderToRow(o) });
const methods = () => calls.map((c) => c.method);

test("шаг вперёд: заказ переезжает в тему стадии — копия, потом удаление старого, дубля нет", async () => {
  set(order({ stage: "new", tgMessageId: 100 }));
  const r = await changeOrder("AAAAAA", { stage: "production" }, actor);
  assert.ok(r.ok && r.changed);
  assert.deepEqual(methods(), ["copyMessage", "deleteMessage"]);
  assert.equal(calls[0].body.message_thread_id, TOPICS.work);
  assert.equal(calls[1].body.message_id, 100); // удалено старое
  assert.equal(row.stage, "production");
  assert.equal(row.tg_message_id, 500); // заказ привязан к новому сообщению
  assert.equal(row.tg_thread_id, TOPICS.work);
  assert.match(String(calls[0].body.caption), /📌 Стадия: 🛠 В производстве/);
  assert.deepEqual(history.map((h) => h.action), ["stage"]);
});

test("старое сообщение не удаляется (старше 48 ч): копия убирается, заказ остаётся на месте с новой стадией", async () => {
  set(order({ stage: "ready", method: "pickup", tgMessageId: 200, tgThreadId: TOPICS.pickup, stageChangedAt: "2026-11-01T08:00:00.000Z" }));
  failDelete.add(200);
  editThread = TOPICS.pickup; // сообщение лежит в «Готов к выдаче»
  const r = await changeOrder("AAAAAA", { stage: "done" }, actor, { via: "chat" });
  assert.ok(r.ok && r.changed);
  assert.deepEqual(methods(), ["copyMessage", "deleteMessage", "deleteMessage", "editMessageCaption"]);
  assert.equal(calls[0].body.disable_notification, true); // попытка переноса старого заказа — без звука
  assert.equal(calls[2].body.message_id, 500); // убрана свежая копия, не сам заказ
  assert.equal(calls[3].body.message_id, 200);
  assert.match(String(calls[3].body.caption), /📌 Стадия: ✅ Завершён/);
  assert.equal(row.tg_message_id, 200); // заказ привязан к прежнему сообщению — дубля нет
  assert.equal(row.tg_thread_id, TOPICS.pickup);
  assert.equal(row.stage, "done");
  assert.ok(row.money_at); // выдан — деньги получены
  assert.equal(history[0].details.via, "chat");
});

test("правка поля без смены стадии: только подпись на месте, без копий и удалений", async () => {
  set(order({ stage: "production", tgMessageId: 300, tgThreadId: TOPICS.work }));
  const r = await changeOrder("AAAAAA", { name: "Мария" }, actor);
  assert.ok(r.ok && r.changed);
  assert.deepEqual(methods(), ["editMessageCaption"]);
  assert.match(String(calls[0].body.caption), /Мария/);
  assert.equal(row.name, "Мария");
  assert.deepEqual(history.map((h) => h.action), ["field"]);
});

test("ничего не изменилось — ни базы, ни чата; неверная правка — ошибка 400", async () => {
  set(order({ stage: "production", tgMessageId: 300, tgThreadId: TOPICS.work }));
  const same = await changeOrder("AAAAAA", { stage: "production" }, actor);
  assert.ok(same.ok && !same.changed);
  const bad = await changeOrder("AAAAAA", { qty: 0 }, actor);
  assert.ok(!bad.ok && bad.status === 400);
  assert.deepEqual(methods(), []);
  assert.deepEqual(history, []);
});

test("старый заказ без записанной темы: бот узнаёт реальную тему и не переносит, если заказ уже на месте", async () => {
  set(order({ stage: "production", tgMessageId: 133, tgThreadId: null, method: "pickup" }));
  editThread = TOPICS.pickup; // по факту сообщение лежит в «Готов к выдаче»
  const r = await changeOrder("AAAAAA", { stage: "ready" }, actor);
  assert.ok(r.ok && r.changed);
  assert.ok(!methods().includes("copyMessage") && !methods().includes("deleteMessage"), "заказ уже в нужной теме — копий и удалений нет");
  assert.equal(row.tg_thread_id, TOPICS.pickup); // тема запомнена
  assert.match(String(calls.at(-1)?.body.caption), /📌 Стадия: 🏪 Готов к выдаче/);
});

test("старый заказ без записанной темы лежит не там: перенос в тему стадии (копия → удалить старое)", async () => {
  set(order({ stage: "production", tgMessageId: 134, tgThreadId: null, method: "pickup" }));
  editThread = TOPICS.work; // по факту сообщение лежит в «В производстве», а нужно — «Готов к выдаче»
  const r = await changeOrder("AAAAAA", { stage: "ready" }, actor);
  assert.ok(r.ok && r.changed);
  assert.ok(methods().includes("copyMessage") && methods().includes("deleteMessage"));
  assert.equal(calls.find((c) => c.method === "copyMessage")?.body.message_thread_id, TOPICS.pickup);
  assert.equal(row.tg_message_id, 500);
  assert.equal(row.tg_thread_id, TOPICS.pickup);
});

test("починка чата: заказы в чужих темах переносятся, на месте — только запоминаются; не удалилось — копия остаётся, старое помечено", async () => {
  const { repairChat } = await import("./telegram.ts");
  const fine = order({ code: "AAAAAA", stage: "ready", tgMessageId: 10, tgThreadId: null, method: "pickup" });
  const wrong = order({ code: "BBBBBB", stage: "done", tgMessageId: 20, tgThreadId: null, method: "pickup" });
  const stuck = order({ code: "CCCCCC", stage: "ready", tgMessageId: 30, tgThreadId: null, method: "posta", postalCode: "2001", city: "Кишинёв", district: "Центр" });
  const known = order({ code: "DDDDDD", stage: "production", tgMessageId: 40, tgThreadId: TOPICS.work, method: "pickup" });
  for (const o of [fine, wrong, stuck, known]) rows[o.code] = { id: o.code, ...orderToRow(o) };
  messageThreads = { 10: TOPICS.pickup, 20: TOPICS.pickup, 30: TOPICS.pickup }; // 10 — на месте; 20 и 30 лежат в «Готов к выдаче»
  failDelete.add(30);
  const result = await repairChat([fine, wrong, stuck, known]);
  assert.equal(result.checked, 4);
  assert.equal(result.alreadyOk, 2); // 10 (узнали тему) и 40 (тема уже известна и верна)
  assert.equal(result.moved, 1); // 20 → «Завершён»
  assert.deepEqual(result.stuck.map((x) => x.code), ["CCCCCC"]);
  assert.equal(rows.AAAAAA.tg_thread_id, TOPICS.pickup);
  assert.equal(rows.BBBBBB.tg_thread_id, TOPICS.done);
  assert.equal(rows.CCCCCC.tg_thread_id, TOPICS.ship); // копия в нужной теме остаётся
  assert.deepEqual(calls.filter((c) => c.method === "copyMessage").map((c) => c.body.message_thread_id), [TOPICS.done, TOPICS.ship]);
  assert.ok(!calls.some((c) => c.method === "deleteMessage" && c.body.message_id === rows.CCCCCC.tg_message_id), "копия застрявшего заказа не удаляется");
  assert.ok(calls.some((c) => c.method === "editMessageCaption" && c.body.message_id === 30 && /перенесён/.test(String(c.body.caption))), "старое сообщение помечено");
});
