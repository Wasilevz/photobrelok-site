import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMdPhone, normalizeMdPhone } from "./phone.ts";
import { MD_DISTRICTS } from "./md-districts.ts";

test("normalizes local formats", () => {
  for (const s of ["69708505", "069708505", "+37369708505", "373 69 708 505", "0 79 748035", "+373 (69) 70-85-05"])
    assert.equal(normalizeMdPhone(s).ok, true, s);
  assert.deepEqual(normalizeMdPhone("069708505"), { ok: true, digits: "69708505" });
});
test("reports digit count problems", () => {
  assert.deepEqual(normalizeMdPhone("6970850"), { ok: false, reason: "short", count: 7 });
  assert.equal((normalizeMdPhone("697085051") as { reason: string }).reason, "long");
  assert.equal((normalizeMdPhone("+40712345678") as { reason: string }).reason, "foreign");
  assert.equal((normalizeMdPhone("  ") as { reason: string }).reason, "empty");
});
test("formats", () => assert.equal(formatMdPhone("69708505"), "+373 69 708 505"));
test("districts list", () => {
  assert.ok(MD_DISTRICTS.length >= 38);
  for (const ro of ["Chișinău", "Bălți", "Briceni", "Căușeni", "Ialoveni", "Rîșcani", "Tiraspol"])
    assert.ok(MD_DISTRICTS.some((d) => d.ro === ro), ro);
  assert.equal(new Set(MD_DISTRICTS.map((d) => d.ro)).size, MD_DISTRICTS.length);
});
