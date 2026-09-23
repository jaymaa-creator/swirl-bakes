import test from "node:test";
import assert from "node:assert/strict";
import { getCurrentBatchKey, resolveMenuBatchKey } from "../src/lib/batchSelection.js";

test("current batch moves forward after the Thursday 10pm Singapore cutoff", () => {
  assert.equal(getCurrentBatchKey(new Date("2026-08-17T09:00:00+08:00")), "2026-08-22");
  assert.equal(getCurrentBatchKey(new Date("2026-08-13T21:59:59+08:00")), "2026-08-15");
  assert.equal(getCurrentBatchKey(new Date("2026-08-13T22:00:01+08:00")), "2026-08-22");
});

test("default menu requests pick the next open Saturday from the calendar, not the stale published current batch", () => {
  const calendar = [
    { date: "2026-08-15", open: true },
    { date: "2026-08-22", open: false },
    { date: "2026-08-29", open: true },
  ];

  const resolved = resolveMenuBatchKey({
    publishedCurrentBatch: "2026-08-15",
    calendar,
    availableSnapshotKeys: ["2026-08-15", "2026-08-29"],
    now: new Date("2026-08-17T09:00:00+08:00"),
  });

  assert.equal(resolved, "2026-08-29");
});
