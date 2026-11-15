import { test } from "node:test";
import assert from "node:assert/strict";
import { importSql, parseExport } from "./import.ts";

const msg = (id: number, unix: number, text: unknown[], extra: Record<string, unknown> = {}) => ({
  id, type: "message", date_unixtime: String(unix), from: "PHOTOBRELOK", from_id: "user8052961990", text, ...extra,
});
const EXPORT = {
  id: 4393765609,
  messages: [
    msg(-999996488, 1793964911, ["🔥 Новый заказ ", { type: "hashtag", text: "#S4R26G" }, "\n👤 Клиент: Polina\n📞 Тел: 61 169 444\n📸 Фотографий: 10 шт.\n🚚 Способ получения: Самовывоз — бесплатно\n📍 A. Bernardazzi 64, Кишинёв (09:00–23:00)"]),
    msg(-999996486, 1794067865, ["🔥 Новый заказ ", { type: "hashtag", text: "#MCF9HY" }, "\n👤 Клиент: Чебанов Иван\n📞 Тел: ", { type: "phone", text: "68736597" }, "\n📸 Фотографий: 6 шт.\n🚚 Способ получения: Nova Poshta — 60 лей\n📦 Отделение №1"]),
    msg(-999996485, 1794067874, ["🔥 ", { type: "bold", text: "АПСЕЛЛ! Заявка " }, { type: "hashtag", text: "#MCF9HY" }, "\nКлиент добавил второй брелок со скидкой 40%.\nПоложите 2 шт. в заказ."]),
    { id: -999996484, type: "message", date_unixtime: "1794068643", from: "Василий", from_id: "user728614952", reply_to_message_id: -999996486, text: "Posta moldovei отправка" },
    { id: 16, type: "service", action: "topic_created", title: "В работе", date_unixtime: "1794394436" },
    msg(112, 1794583269, ["🔥 Новый заказ ", { type: "hashtag", text: "#LEFQ25" }, " — ⚠️ 2 БРЕЛКА\n━━━━━━━━━━━━━━━\n⚠️ ВТОРОЙ БРЕЛОК\nПоложите в заказ 2 штуки\nСтоимость: 400 лей плюс доставка\n━━━━━━━━━━━━━━━\n👤 Клиент: Ghenadie Lozan\n📞 Тел: ", { type: "phone", text: "078015939" }, "\n📸 Фотографий: 6 шт.\n🚚 Способ получения: Poșta Moldovei — 30 лей\n📮 Индекс: 4701\n🏘 Briceni, р-н Briceni\n🕒 13.11 17:21 · 🚚 Отправлен"], { reply_to_message_id: 19 }),
    msg(115, 1794641364, ["🔥 Новый заказ ", { type: "hashtag", text: "#YRQ5EQ" }, "\n👤 Клиент: Илья\n🏠 Улица: ", { type: "phone", text: "77828888" }, "\n🏘 Район: Мечникова 31\n📮 Индекс: 3300\n🏙 Город: Тирасполь\n📞 Тел: ", { type: "phone", text: "60790351" }, "\n📣 Источник: переход с ", { type: "link", text: "l.instagram.com" }, "\n🚚 Способ получения: Poșta Moldovei — 30 лей\n📝 Илья Красковский г. Тирасполь, 3300, ул. Мечникова 31\n📝 ОПЛАЧЕНО 280 ЛЕЙ"], { reply_to_message_id: 16 }),
    msg(139, 1794760090, ["🔥 Новый заказ ", { type: "hashtag", text: "#CTW8PT" }, "\n👤 Клиент: Bogdan Adascalita\n📞 Тел: ", { type: "phone", text: "079039263" }, "\n🌐 Клиент оформлял на румынском (по возможности говорите по-румынски)\n📣 Источник: реклама Meta fbclid\n🚚 Способ получения: Самовывоз"], { reply_to_message_id: 16 }),
  ],
};

const byCode = () => Object.fromEntries(parseExport(EXPORT, { work: 16, done: 19 }).map((o) => [o.code, o]));

test("stages from topics; old group → done", () => {
  const o = byCode();
  assert.equal(o.S4R26G.stage, "done");
  assert.equal(o.LEFQ25.stage, "done");
  assert.equal(o.YRQ5EQ.stage, "production");
  assert.equal(o.CTW8PT.stage, "production");
});
test("fields, qty, lang, source, flags", () => {
  const o = byCode();
  assert.equal(Object.keys(o).length, 5);
  assert.equal(o.MCF9HY.qty, 2);
  assert.equal(o.LEFQ25.qty, 2);
  assert.equal(o.S4R26G.qty, 1);
  assert.equal(o.MCF9HY.method, "novapost");
  assert.equal(o.MCF9HY.branch, "1");
  assert.equal(o.LEFQ25.city, "Briceni");
  assert.equal(o.CTW8PT.lang, "ro");
  assert.equal(o.CTW8PT.source, "реклама Meta fbclid");
  assert.deepEqual(o.S4R26G.flags, ["imported"]);
  assert.equal(o.S4R26G.createdAt, new Date(1793964911 * 1000).toISOString());
});
test("chat message link only for the supergroup", () => {
  const o = byCode();
  assert.equal(o.S4R26G.tgMessageId, null);
  assert.equal(o.S4R26G.tgChatId, null);
  assert.equal(o.YRQ5EQ.tgMessageId, 115);
  assert.equal(o.YRQ5EQ.tgChatId, -1004393765609);
  assert.ok(o.YRQ5EQ.tgCaption?.startsWith("🔥 Новый заказ #YRQ5EQ"));
});
test("comments from 📝 notes and replies in chat", () => {
  const o = byCode();
  assert.deepEqual(o.YRQ5EQ.comments.map((c) => c.text), ["Илья Красковский г. Тирасполь, 3300, ул. Мечникова 31", "ОПЛАЧЕНО 280 ЛЕЙ"]);
  assert.deepEqual(o.MCF9HY.comments.map((c) => [c.author, c.text]), [["Василий", "Posta moldovei отправка"]]);
});
test("SQL is idempotent and safely quoted", () => {
  const sql = importSql(parseExport(EXPORT, { work: 16, done: 19 }));
  assert.ok(sql.includes("on conflict (code) do nothing"));
  assert.ok(!/\b(delete|drop|truncate)\b/i.test(sql));
  const tricky = importSql([{ ...byCode().CTW8PT, name: "O'Neil" }]);
  assert.ok(tricky.includes("'O''Neil'"));
});
