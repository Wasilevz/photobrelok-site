import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  chisinauToday,
  earliestDate,
  formatDay,
  parseManagerDate,
  shipBy,
  urgentOpen,
  validateWanted,
} from "./delivery-dates.ts";

const at = (iso: string) => new Date(iso); // UTC

test("chisinau today differs from UTC late evening", () =>
  assert.equal(chisinauToday(at("2026-11-15T22:30:00Z")), "2026-11-16")); // 00:30 Кишинёв
test("pickup earliest is tomorrow", () =>
  assert.equal(earliestDate("pickup", at("2026-11-15T10:00:00Z")), "2026-11-16"));
test("post: Monday order -> receive from Saturday", () =>
  assert.equal(earliestDate("posta", at("2026-11-16T10:00:00Z")), "2026-11-21"));
test("post: Friday order -> receive from next Friday", () =>
  assert.equal(earliestDate("novapost", at("2026-11-20T10:00:00Z")), "2026-11-27"));
test("post: Saturday order counts workdays from Monday", () =>
  assert.equal(shipBy(at("2026-11-21T10:00:00Z")), "2026-11-24"));
test("DST change does not shift tomorrow", () => {
  assert.equal(earliestDate("pickup", at("2026-03-28T22:30:00Z")), "2026-03-30"); // 00:30 29.03 по Кишинёву
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
});
test("urgent closes at 18:00, server grace until 18:30", () => {
  const t = at("2026-11-15T16:10:00Z"); // 18:10 Кишинёв (UTC+2)
  assert.equal(urgentOpen(t), false);
  assert.equal(urgentOpen(t, 30), true);
  assert.equal(urgentOpen(at("2026-11-15T15:59:00Z")), true);
});
test("validateWanted", () => {
  const now = at("2026-11-15T10:00:00Z");
  assert.equal(validateWanted({ method: "pickup", wantedDate: "2026-11-15", urgent: true, now }), null);
  assert.equal(validateWanted({ method: "pickup", wantedDate: "2026-11-15", urgent: false, now }), "too_early");
  assert.equal(validateWanted({ method: "posta", wantedDate: "2026-11-15", urgent: true, now }), "urgent_post");
  assert.equal(validateWanted({ method: "posta", wantedDate: "2026-11-19", urgent: false, now }), "too_early");
  assert.equal(validateWanted({ method: "posta", wantedDate: "2026-11-20", urgent: false, now }), null);
  assert.equal(validateWanted({ method: "pickup", wantedDate: "2026-11-17", urgent: true, now }), "urgent_date");
  assert.equal(validateWanted({ method: "pickup", wantedDate: "2027-03-01", urgent: false, now }), "too_far");
  assert.equal(validateWanted({ method: "pickup", wantedDate: "16.11", urgent: false, now }), "format");
  assert.equal(validateWanted({ method: "taxi", wantedDate: "2026-11-15", urgent: true, now: at("2026-11-15T16:40:00Z"), graceMinutes: 30 }), "urgent_late");
});
test("parseManagerDate picks nearest future year", () => {
  const now = at("2026-12-28T10:00:00Z");
  assert.equal(parseManagerDate("03.01", now), "2027-01-03");
  assert.equal(parseManagerDate("30.12", now), "2026-12-30");
  assert.equal(parseManagerDate("21/1", now), "2027-01-21");
  assert.equal(parseManagerDate("21.11.2026", now), "2026-11-21");
  assert.equal(parseManagerDate("31.02", now), null);
  assert.equal(parseManagerDate("завтра", now), null);
});
test("formatDay", () => {
  assert.equal(formatDay("2026-11-21", "ru"), "сб 21.11");
  assert.equal(formatDay("2026-11-21", "ro"), "sâm 21.11");
});
