import { test } from "node:test";
import assert from "node:assert/strict";
import { intakeCaption } from "./order-intake.ts";

test("caption marks orders that did not reach CRM", () => {
  assert.equal(intakeCaption("🔥 Новый заказ #ABC234", true), "🔥 Новый заказ #ABC234");
  assert.equal(intakeCaption("🔥 Новый заказ #ABC234", false), "🔥 Новый заказ #ABC234\n⚠️ Не записан в CRM");
});
