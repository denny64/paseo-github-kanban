import assert from "node:assert/strict";
import { test } from "node:test";
import { runAtLabel, schedulePresets, timeAgo } from "../shared/time.ts";

test("timeAgo buckets into now / minutes / hours / days / date", () => {
  const now = Date.parse("2026-09-25T12:00:00Z");
  assert.equal(timeAgo("2026-09-25T11:59:30Z", now), "now");
  assert.equal(timeAgo("2026-09-25T11:55:00Z", now), "5m");
  assert.equal(timeAgo("2026-09-25T09:00:00Z", now), "3h");
  assert.equal(timeAgo("2026-09-13T12:00:00Z", now), "12d");
  assert.match(timeAgo("2026-07-01T12:00:00Z", now), /Jul|7/);
});

test("runAtLabel names the day relative to now", () => {
  const now = new Date(2026, 8, 25, 12, 0).getTime();
  assert.match(runAtLabel(new Date(2026, 8, 25, 23, 0).toISOString(), now), /today$/);
  assert.match(runAtLabel(new Date(2026, 8, 26, 2, 0).toISOString(), now), /tomorrow$/);
  assert.doesNotMatch(runAtLabel(new Date(2026, 8, 28, 2, 0).toISOString(), now), /today|tomorrow/);
});

test("schedulePresets are in the future and in order", () => {
  for (const hour of [0, 1, 2, 8, 12, 22, 23]) {
    const now = new Date(2026, 8, 25, hour, 50).getTime();
    const fixed = schedulePresets(now).slice(2).map((p) => Date.parse(p.at));
    assert.equal(fixed.length, 3);
    assert.ok(fixed.every((at) => at >= now + 15 * 60_000 && at < now + 86_400_000 + 15 * 60_000), `hour ${hour}`);
    assert.deepEqual([...fixed].sort((a, b) => a - b), fixed);
  }
});
