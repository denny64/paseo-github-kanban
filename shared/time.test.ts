import assert from "node:assert/strict";
import { test } from "node:test";
import { timeAgo } from "./time.ts";

test("timeAgo buckets into now / minutes / hours / days / date", () => {
  const now = Date.parse("2026-09-25T12:00:00Z");
  assert.equal(timeAgo("2026-09-25T11:59:30Z", now), "now");
  assert.equal(timeAgo("2026-09-25T11:55:00Z", now), "5m");
  assert.equal(timeAgo("2026-09-25T09:00:00Z", now), "3h");
  assert.equal(timeAgo("2026-09-13T12:00:00Z", now), "12d");
  assert.match(timeAgo("2026-07-01T12:00:00Z", now), /Jul|7/);
});
