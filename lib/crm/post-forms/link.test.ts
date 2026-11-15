import { test } from "node:test";
import assert from "node:assert/strict";
import { signFormsLink, verifyFormsLink } from "./link.ts";

const secret = "123:bot-token";

test("ссылка на бланки: подпись, срок, заказы, вид бланка и пробная печать", () => {
  const q = signFormsLink({ codes: ["3MQXGQ", "ABC234"], kind: "tfp3", test: true }, secret, 1000);
  const p = new URLSearchParams(q);
  assert.deepEqual(verifyFormsLink(p, secret, 1000 + 599), { codes: ["3MQXGQ", "ABC234"], kind: "tfp3", test: true });
  assert.equal(verifyFormsLink(p, secret, 1000 + 601), null); // 10 минут прошли
  assert.equal(verifyFormsLink(p, "other", 1000), null);
  const swapped = new URLSearchParams(q);
  swapped.set("c", "3MQXGQ,ZZZZZZ");
  assert.equal(verifyFormsLink(swapped, secret, 1000), null); // подменили заказы
  const kind = new URLSearchParams(q);
  kind.set("k", "ramburs");
  assert.equal(verifyFormsLink(kind, secret, 1000), null); // подменили бланк
  assert.equal(verifyFormsLink(new URLSearchParams("c=bad"), secret, 1000), null);
});

test("пробный лист без заказов", () => {
  const q = signFormsLink({ codes: [], kind: "ramburs", test: true }, secret, 1000);
  assert.deepEqual(verifyFormsLink(new URLSearchParams(q), secret, 1000), { codes: [], kind: "ramburs", test: true });
});
