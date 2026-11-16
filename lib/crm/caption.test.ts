import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCrmCaption } from "./caption.ts";
import type { CrmOrder } from "./model.ts";

const UPSELL = "🔥 Новый заказ #X46XXY — ⚠️ 2 БРЕЛКА\n━━━━━━━━━━━━━━━\n⚠️ ВТОРОЙ БРЕЛОК\nПоложите в заказ 2 штуки\nСтоимость: 400 лей плюс доставка\n━━━━━━━━━━━━━━━\n👤 Клиент: Виктория\n📞 Тел: 079797981\n🌐 Клиент оформлял на румынском (по возможности говорите по-румынски)\n📣 Источник: переход с instagram.com\n🚚 Способ получения: Самовывоз\n📝 заметка";

function order(p: Partial<CrmOrder> = {}): CrmOrder {
  return {
    code: "X46XXY", createdAt: "2026-11-14T12:02:27Z", stage: "new", stageChangedAt: "2026-11-14T12:02:27Z",
    name: "Виктория", phone: "+373 79 797 981", wantedDate: null, urgent: false, method: "pickup",
    postalCode: null, city: null, district: null, street: null, branch: null, address: null,
    qty: 2, price: null, lang: "ro", source: "instagram", pdfPath: null, tgChatId: -1004393765609, tgMessageId: 126,
    tgCaption: UPSELL, flags: [], commentsCount: 0, boxes: null, extraCost: null, paid: false, deletedAt: null, tgThreadId: null, ...p,
  };
}

test("stage line is single and updated", () => {
  const first = buildCrmCaption(order({ stage: "production" }));
  const again = buildCrmCaption(order({ stage: "ready", tgCaption: first }));
  assert.equal(again.split("\n").filter((l) => l.startsWith("📌")).length, 1);
  assert.ok(again.includes("📌 Стадия: 🏪 Готов к выдаче"));
  assert.ok(buildCrmCaption(order({ stage: "ready", method: "novapost", branch: "12" })).includes("📌 Стадия: 📦 Готов к отправке"));
});
test("keeps upsell block, language, source, notes; updates fields", () => {
  const out = buildCrmCaption(order({ phone: "+373 60 000 000" }));
  assert.ok(out.startsWith("🔥 Новый заказ #X46XXY — ⚠️ 2 БРЕЛКА\n━━━━━━━━━━━━━━━\n⚠️ ВТОРОЙ БРЕЛОК"));
  for (const keep of ["🌐 Клиент оформлял", "📣 Источник", "📝 заметка"]) assert.ok(out.includes(keep), keep);
  assert.ok(out.includes("📞 Тел: +373 60 000 000"));
  assert.ok(!out.includes("079797981"));
});
test("qty line for 3+ and replaced on change", () => {
  const three = buildCrmCaption(order({ qty: 3 }));
  assert.ok(three.includes("🔑 Брелков: 3"));
  const one = buildCrmCaption(order({ qty: 1, tgCaption: three }));
  assert.ok(!one.includes("🔑"));
});
test("drops the 'not saved to CRM' warning", () => {
  const out = buildCrmCaption(order({ tgCaption: `${UPSELL}\n⚠️ Не записан в CRM` }));
  assert.ok(!out.includes("Не записан в CRM"));
});
test("fits Telegram caption limit by dropping oldest history", () => {
  const history = Array.from({ length: 40 }, (_, i) => `🕒 ${String(i).padStart(2, "0")}.11 10:00 · ✏️ Изменено: телефон, дата, способ`).join("\n");
  const out = buildCrmCaption(order({ tgCaption: `${UPSELL}\n${history}` }));
  assert.ok(out.length <= 1000, String(out.length));
  assert.ok(out.includes("📌 Стадия"));
  assert.ok(out.includes("🕒 39.11"));
  assert.ok(!out.includes("🕒 00.11"));
});
test("no caption yet → minimal one", () => {
  const out = buildCrmCaption(order({ tgCaption: null, qty: 1 }));
  assert.ok(out.startsWith("🔥 Новый заказ #X46XXY"));
  assert.ok(out.includes("👤 Клиент: Виктория"));
});
test("post order gets ship-by date 3 days before wanted", () => {
  const out = buildCrmCaption(order({ method: "posta", postalCode: "3300", city: "Тирасполь", district: "Тирасполь", wantedDate: "2026-11-21" }));
  assert.ok(out.includes("📅 Нужен к: сб 21.11 · отправить до: ср 18.11"));
});
test("qty set by hand: 2 without upsell block gets a line, 1 removes the block", () => {
  const plain = "🔥 Новый заказ #C3P4LB\n👤 Клиент: Мария\n📞 Тел: 060024571\n🚚 Способ получения: Самовывоз";
  assert.ok(buildCrmCaption(order({ code: "C3P4LB", tgCaption: plain, qty: 2 })).includes("🔑 Брелков: 2"));
  const single = buildCrmCaption(order({ qty: 1 }));
  assert.ok(!single.includes("2 БРЕЛКА"));
  assert.ok(!single.includes("ВТОРОЙ БРЕЛОК"));
  assert.ok(single.includes("📝 заметка"));
});

test("оплачен: строка под стадией — для почты «наложенный платёж не оформлять», для выдачи «деньги не брать»; снятие убирает строку", () => {
  const post = buildCrmCaption(order({ paid: true, method: "posta", postalCode: "MD-2001", city: "Chișinău", district: "Chișinău" }));
  const lines = post.split("\n");
  const stage = lines.findIndex((l) => l.startsWith("📌 Стадия:"));
  assert.equal(lines[stage + 1], "💳 ОПЛАЧЕН на карту — наложенный платёж НЕ оформлять");
  const pickup = buildCrmCaption(order({ paid: true }));
  assert.ok(pickup.includes("💳 ОПЛАЧЕН на карту — деньги с клиента НЕ брать"));
  const unpaid = buildCrmCaption(order({ paid: false, tgCaption: pickup }));
  assert.ok(!unpaid.includes("ОПЛАЧЕН"));
  assert.equal(buildCrmCaption(order({ paid: true, tgCaption: pickup })).match(/ОПЛАЧЕН/g)?.length, 1);
});

test("удалённый из CRM: стадия «Удалён из CRM», остальная подпись на месте", () => {
  const c = buildCrmCaption(order({ deletedAt: "2026-11-16T10:00:00Z" }));
  assert.ok(c.includes("📌 Стадия: 🗑 Удалён из CRM"));
  assert.ok(c.includes("Виктория"));
});
