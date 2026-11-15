import { test } from "node:test";
import assert from "node:assert/strict";
import { amountWordsRo, formData, localPhone, numberWordsRo, parseSender, type Sender } from "./data.ts";

test("numberWordsRo", () => {
  const cases: [number, string][] = [
    [0, "zero"], [1, "unu"], [2, "doi"], [10, "zece"], [11, "unsprezece"], [12, "doisprezece"], [14, "paisprezece"],
    [16, "șaisprezece"], [20, "douăzeci"], [21, "douăzeci și unu"], [62, "șaizeci și doi"], [100, "o sută"],
    [250, "două sute cincizeci"], [400, "patru sute"], [650, "șase sute cincizeci"], [1000, "o mie"],
    [1050, "o mie cincizeci"], [2300, "două mii trei sute"], [12000, "douăsprezece mii"], [25000, "douăzeci și cinci de mii"],
  ];
  for (const [n, w] of cases) assert.equal(numberWordsRo(n), w, String(n));
});

test("amountWordsRo — как в образце почты", () => {
  assert.equal(amountWordsRo(500), "Cinci sute lei, zero bani");
  assert.equal(amountWordsRo(250), "Două sute cincizeci lei, zero bani");
});

test("localPhone: +373 → 0XX XXX XXX", () => {
  assert.equal(localPhone("+373 68 866 772"), "068 866 772");
  assert.equal(localPhone("079797981"), "079 797 981");
  assert.equal(localPhone("что-то"), "что-то");
});

const sender: Sender = {
  name: "Vlad Rusnac", street: "str. Alexandru Bernardazzi 64", locality: "MD-2012, CHIȘINĂU", phone: "078 238 455",
  payout: "address", idnp: "", iban: "", parcelType: "pachet", declareValue: true,
};

test("parseSender: обязательные поля, IDNP и IBAN для карты", () => {
  assert.deepEqual(parseSender(sender), { ok: true, value: sender });
  assert.equal(parseSender({ ...sender, name: " " }).ok, false);
  assert.equal(parseSender({ ...sender, payout: "card", idnp: "123", iban: "MD64VI23289213921304375934501" }).ok, false);
  const card = parseSender({ ...sender, payout: "card", idnp: "2004001234567", iban: "md64 vi23 2892 1392 1304 3759 3450 1" });
  assert.ok(card.ok && card.value.iban === "MD64VI23289213921304375934501");
});

test("formData: наложенный платёж и обычное отправление", () => {
  const o = {
    code: "3MQXGQ", name: "Bogdan Capatina", phone: "+373 68 866 772", method: "posta" as const,
    postalCode: "MD-4300", city: "Căușeni", district: "Căușeni", street: "Nadejda Neaga 14",
    qty: 2, urgent: false, price: null, paid: false,
  };
  const cod = formData(o, sender);
  assert.equal(cod.cod, true);
  assert.equal(cod.amount, 400);
  assert.equal(cod.amountDigits, "400");
  assert.equal(cod.amountCents, "400,00");
  assert.equal(cod.amountWords, "Patru sute lei, zero bani");
  assert.deepEqual(cod.recipient, { name: "Bogdan Capatina", street: "Nadejda Neaga 14", locality: "MD-4300, CĂUȘENI", phone: "068 866 772" });
  assert.equal(cod.declaredDigits, "400");
  const paid = formData({ ...o, paid: true, city: "Tănătari" }, sender);
  assert.equal(paid.cod, false);
  assert.equal(paid.declaredDigits, "");
  assert.equal(paid.recipient.locality, "MD-4300, TĂNĂTARI, r-nul Căușeni");
});
