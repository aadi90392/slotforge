import { test } from "node:test";
import assert from "node:assert/strict";
import { validSlot, slotTime, timeLabel } from "../lib/domain.ts";
const now = Date.parse("2026-11-01T00:00:00Z");
test("a valid future one-hour slot is accepted", () =>
  assert(validSlot("2026-11-06", 10, now)));
test("impossible dates cannot create a second representation of a slot", () =>
  assert.equal(validSlot("2026-11-31", 10, now), false));
test("past and out-of-window dates are rejected", () => {
  assert.equal(validSlot("2026-10-01", 10, now), false);
  assert.equal(validSlot("2027-02-01", 10, now), false);
});
test("only complete working-hour slots are accepted", () => {
  for (const h of [7, 19, 10.5, NaN])
    assert.equal(validSlot("2026-11-06", h, now), false);
});
test("IST input is converted independently of host timezone", () =>
  assert.equal(
    new Date(slotTime("2026-11-06", 10)).toISOString(),
    "2026-11-06T04:30:00.000Z",
  ));
test("noon, midnight and afternoon labels are correct", () => {
  assert.equal(timeLabel(12), "12:00 PM");
  assert.equal(timeLabel(0), "12:00 AM");
  assert.equal(timeLabel(18), "6:00 PM");
});
