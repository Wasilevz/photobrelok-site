import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTemplate, fieldsFromCaption, fieldsTemplate, setFieldLines } from "./order-fields.ts";

const now = new Date("2026-11-15T10:00:00Z");
const OLD_POST = "🔥 Новый заказ #YRQ5EQ\n👤 Клиент: Илья\n🏠 Улица: 77828888\n🏘 Район: Мечникова 31\n📮 Индекс: 3300\n🏙 Город: Тирасполь\n📞 Тел: 60790351\n📣 Источник: переход с l.instagram.com\n🚚 Способ получения: Poșta Moldovei — 30 лей\n🕒 14.11 09:40 · ✏️ Доставка изменена\n📝 ОПЛАЧЕНО 280 ЛЕЙ";
const UPSELL = "🔥 Новый заказ #X46XXY — ⚠️ 2 БРЕЛКА\n━━━━━━━━━━━━━━━\n⚠️ ВТОРОЙ БРЕЛОК\nПоложите в заказ 2 штуки\nСтоимость: 400 лей плюс доставка\n━━━━━━━━━━━━━━━\n👤 Клиент: Виктория\n📞 Тел: 079797981\n🌐 Клиент оформлял на румынском (по возможности говорите по-румынски)\n📣 Источник: переход с instagram.com\n🚚 Способ получения: Самовывоз\n📝 заметка";
const VERY_OLD = "🔥 Новый заказ #95TZYC\n👤 Клиент: Андрей\n📞 Тел: 079178354\n📸 Фотографий: 10 шт.\n🚚 Способ получения: Poșta Moldovei — 30 лей\n📮 Индекс: 5642\n🏘 Vasileuți, р-н Рышканы";
const OLD_NOVA = "🔥 Новый заказ #MCF9HY\n👤 Клиент: Чебанов Иван\n📞 Тел: 68736597\n📸 Фотографий: 6 шт.\n🚚 Способ получения: Nova Poshta — 60 лей\n📦 Отделение №1";

test("reads fields from current caption", () => {
  const f = fieldsFromCaption(OLD_POST, now);
  assert.equal(f.method, "posta");
  assert.equal(f.postalCode, "3300");
  assert.equal(f.city, "Тирасполь");
  assert.equal(f.phone, "60790351");
  assert.equal(f.urgent, false);
});
test("reads old 'Город, р-н Район' format and Nova Poshta branch", () => {
  const f = fieldsFromCaption(VERY_OLD, now);
  assert.equal(f.city, "Vasileuți");
  assert.equal(f.district, "Рышканы");
  assert.equal(fieldsFromCaption(OLD_NOVA, now).branch, "1");
});
test("template round-trips", () => {
  for (const c of [OLD_POST, UPSELL, VERY_OLD, OLD_NOVA]) {
    const f = fieldsFromCaption(c, now);
    const r = applyTemplate(fieldsTemplate(f), f, now);
    assert.ok(r.ok, c);
    assert.deepEqual(r.fields, f);
    assert.deepEqual(r.changed, []);
  }
});
test("template has no blank lines", () => {
  assert.ok(!fieldsTemplate(fieldsFromCaption(OLD_POST, now)).includes("\n\n"));
});
test("labels: any case, aliases, order, missing lines", () => {
  const f = fieldsFromCaption(OLD_POST, now);
  const r = applyTemplate("район: Тирасполь\n  УЛИЦА :  Мечникова 31\nтел: +373 77828888", f, now);
  assert.ok(r.ok);
  assert.equal(r.fields.street, "Мечникова 31");
  assert.equal(r.fields.district, "Тирасполь");
  assert.equal(r.fields.phone, "+373 77828888");
  assert.equal(r.fields.postalCode, "3300");
  assert.deepEqual([...r.changed].sort(), ["район", "телефон", "улица"]);
});
test("unknown label is reported", () => {
  const r = applyTemplate("Индкс: 3300", fieldsFromCaption(OLD_POST, now), now);
  assert.equal(r.ok, false);
});
test("method switch requires its fields", () => {
  const f = fieldsFromCaption(UPSELL, now);
  assert.equal((applyTemplate("Способ: почта", f, now) as { error: string }).error, "Для почты нужны: индекс, город, район");
  assert.ok(applyTemplate("Способ: такси\nАдрес: Колумна 5\nСрочно: да", f, now).ok);
  assert.equal((applyTemplate("Способ: ракета", f, now) as { ok: boolean }).ok, false);
  assert.equal((applyTemplate("Способ: почта\nИндекс: 2001\nГород: Кишинёв\nРайон: Кишинёв\nСрочно: да", f, now) as { error: string }).error, "Срочно — только самовывоз или такси");
});
test("urgent yes without date means today; date parsing", () => {
  const r = applyTemplate("Срочно: да", fieldsFromCaption(UPSELL, now), now);
  assert.ok(r.ok);
  assert.equal(r.fields.wantedDate, "2026-11-15");
  const d = applyTemplate("Нужен к: 21.11", fieldsFromCaption(UPSELL, now), now);
  assert.ok(d.ok);
  assert.equal(d.fields.wantedDate, "2026-11-21");
  assert.deepEqual(d.changed, ["дата"]);
  assert.equal((applyTemplate("Дата: в пятницу", fieldsFromCaption(UPSELL, now), now) as { error: string }).error, "Дата — в виде ДД.ММ, например 21.11");
});
test("setFieldLines keeps upsell block, language, source, notes", () => {
  const f = { ...fieldsFromCaption(UPSELL, now), phone: "060000000", wantedDate: "2026-11-21" };
  const out = setFieldLines(UPSELL, f);
  assert.ok(out.startsWith("🔥 Новый заказ #X46XXY — ⚠️ 2 БРЕЛКА\n━━━━━━━━━━━━━━━\n⚠️ ВТОРОЙ БРЕЛОК"));
  for (const keep of ["🌐 Клиент оформлял", "📣 Источник", "📝 заметка"]) assert.ok(out.includes(keep), keep);
  assert.ok(out.includes("📞 Тел: 060000000"));
  assert.ok(out.includes("📅 Нужен к: сб 21.11"));
  assert.equal(out.split("\n").filter((l) => l.startsWith("📞")).length, 1);
  assert.ok(out.indexOf("🚚") < out.indexOf("📝"));
});
test("urgent and post lines", () => {
  const f = { ...fieldsFromCaption(UPSELL, now), urgent: true, wantedDate: "2026-11-15" };
  const u = setFieldLines(UPSELL, f).split("\n");
  assert.equal(u[6], "⚡ СРОЧНО +100 лей · на сегодня 15.11");
  const p = { ...fieldsFromCaption(OLD_POST, now), wantedDate: "2026-11-21" };
  const out = setFieldLines(OLD_POST, p, "2026-11-19");
  assert.ok(out.includes("📅 Нужен к: сб 21.11 · отправить до: чт 19.11"));
  assert.equal(fieldsFromCaption(out, now).wantedDate, "2026-11-21");
});
test("setFieldLines on old caption drops photo line and rebuilds address", () => {
  const out = setFieldLines(VERY_OLD, fieldsFromCaption(VERY_OLD, now));
  assert.ok(!out.includes("📸"));
  assert.ok(out.includes("🏙 Город: Vasileuți"));
  assert.ok(out.includes("🏘 Район: Рышканы"));
});
