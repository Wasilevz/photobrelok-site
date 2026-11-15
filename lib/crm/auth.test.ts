import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { authorize, parseAllowed, verifyInitData } from "./auth.ts";

const T = "123456:TEST-token";
const NOW = 1794780100;

function sign(fields: Record<string, string>, token: string): string {
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
const USER = JSON.stringify({ id: 42, first_name: "Вася", last_name: "П" });
const good = () => sign({ auth_date: "1794780000", query_id: "AA", user: USER }, T);

test("valid initData passes", () =>
  assert.deepEqual(verifyInitData(good(), T, NOW), { ok: true, user: { id: 42, name: "Вася П" } }));
test("tampered field fails", () => {
  const p = new URLSearchParams(good());
  p.set("user", JSON.stringify({ id: 43, first_name: "Вася" }));
  assert.deepEqual(verifyInitData(p.toString(), T, NOW), { ok: false, reason: "bad_signature" });
});
test("other bot token fails", () =>
  assert.deepEqual(verifyInitData(sign({ auth_date: "1794780000", user: USER }, "999:other"), T, NOW), { ok: false, reason: "bad_signature" }));
test("older than 24h fails", () =>
  assert.deepEqual(verifyInitData(good(), T, 1794780000 + 86401), { ok: false, reason: "expired" }));
test("no user / malformed", () => {
  assert.deepEqual(verifyInitData(sign({ auth_date: "1794780000" }, T), T, NOW), { ok: false, reason: "no_user" });
  assert.deepEqual(verifyInitData("garbage", T, NOW), { ok: false, reason: "malformed" });
});
test("parseAllowed", () => assert.deepEqual([...parseAllowed(" 42, 905831355 ,x,")], [42, 905831355]));
test("authorize", () => {
  const env = { botToken: T, allowed: "42" };
  assert.deepEqual(authorize(good(), env, NOW), { ok: true, user: { id: 42, name: "Вася П" } });
  assert.deepEqual(authorize(good(), { botToken: T, allowed: "7" }, NOW), { ok: false, status: 403 });
  assert.deepEqual(authorize(good(), { botToken: T, allowed: "" }, NOW), { ok: false, status: 403 });
  assert.deepEqual(authorize(null, env, NOW), { ok: false, status: 401 });
  assert.deepEqual(authorize(good(), { allowed: "42" }, NOW), { ok: false, status: 401 }); // нет токена бота
});
test("dev user only outside production", () => {
  assert.deepEqual(authorize(null, { devUserId: "42", allowed: "42", nodeEnv: "development" }, NOW), { ok: true, user: { id: 42, name: "Разработка" } });
  assert.deepEqual(authorize(null, { devUserId: "42", allowed: "42", nodeEnv: "production" }, NOW), { ok: false, status: 401 });
  assert.deepEqual(authorize(null, { devUserId: "7", allowed: "42", nodeEnv: "development" }, NOW), { ok: false, status: 403 });
});
