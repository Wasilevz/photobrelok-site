import { test } from "node:test";
import assert from "node:assert/strict";
import { crmAppUrl, crmKeyboardFor } from "./links.ts";

test("crm link", () => {
  assert.equal(crmAppUrl("7AZER9", "photobrelok_bot"), "https://t.me/photobrelok_bot/crm?startapp=7AZER9");
  assert.equal(crmAppUrl("7AZER9", "@photobrelok_bot"), "https://t.me/photobrelok_bot/crm?startapp=7AZER9");
  assert.equal(crmAppUrl("7AZER9", undefined), null);
  assert.equal(crmAppUrl("7AZER9", ""), null);
});
test("crm keyboard", () => {
  assert.deepEqual(crmKeyboardFor("7AZER9", "photobrelok_bot"), [[{ text: "📋 Открыть в CRM", url: "https://t.me/photobrelok_bot/crm?startapp=7AZER9" }]]);
  assert.deepEqual(crmKeyboardFor("7AZER9", undefined), []);
});
