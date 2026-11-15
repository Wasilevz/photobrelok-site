import { test } from "node:test";
import assert from "node:assert/strict";
import { signFormsLink, verifyFormsLink } from "./link.ts";

const secret = "123:bot-token";

test("ссылка на бланки: подпись, срок, список заказов", () => {
  const q = signFormsLink(["3MQXGQ", "ABC234"], secret, 1000);
  const p = new URLSearchParams(q);
  assert.deepEqual(verifyFormsLink(p, secret, 1000 + 599), ["3MQXGQ", "ABC234"]);
  assert.equal(verifyFormsLink(p, secret, 1000 + 601), null); // 10 минут прошли
  assert.equal(verifyFormsLink(p, "other", 1000), null);
  p.set("c", "3MQXGQ,ZZZZZZ");
  assert.equal(verifyFormsLink(p, secret, 1000), null); // подменили заказы
  assert.equal(verifyFormsLink(new URLSearchParams("c=bad"), secret, 1000), null);
});
