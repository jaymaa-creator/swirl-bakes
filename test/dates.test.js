import test from "node:test";
import assert from "node:assert/strict";
import { getCutoffForSaturday, getNextOrderCutoff, isSaturdayOpen } from "../src/lib/dates.js";

test("Saturday batches close at 10pm Singapore time on the preceding Thursday", () => {
  const saturday = new Date("2026-08-01T12:00:00+08:00");
  const cutoff = getCutoffForSaturday(saturday);

  assert.equal(cutoff.toISOString(), "2026-07-30T14:00:00.000Z");
  assert.equal(isSaturdayOpen(saturday, new Date("2026-07-30T21:59:59+08:00")), true);
  assert.equal(isSaturdayOpen(saturday, new Date("2026-07-30T22:00:00+08:00")), false);
});

test("the countdown rolls to the next available week's cut-off after Thursday 10pm", () => {
  const cutoff = getNextOrderCutoff(new Date("2026-07-30T22:00:01+08:00"));
  assert.equal(cutoff.toISOString(), "2026-08-06T14:00:00.000Z");
});
