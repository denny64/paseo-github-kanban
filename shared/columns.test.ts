import assert from "node:assert/strict";
import { test } from "node:test";
import { columnFor, labelChanges } from "./columns.ts";

test("columnFor derives the column from state and labels", () => {
  assert.equal(columnFor({ state: "OPEN", labels: [] }), "todo");
  assert.equal(columnFor({ state: "OPEN", labels: ["bug", "kanban:in-progress"] }), "in-progress");
  assert.equal(columnFor({ state: "OPEN", labels: ["kanban:in-progress", "kanban:in-review"] }), "in-review");
  assert.equal(columnFor({ state: "CLOSED", labels: ["kanban:in-progress"] }), "done");
});

test("labelChanges swaps kanban labels and leaves others alone", () => {
  assert.deepEqual(labelChanges(["bug"], "in-progress"), { add: ["kanban:in-progress"], remove: [] });
  assert.deepEqual(labelChanges(["bug", "kanban:in-progress"], "in-review"), {
    add: ["kanban:in-review"],
    remove: ["kanban:in-progress"],
  });
  assert.deepEqual(labelChanges(["kanban:in-review"], "todo"), { add: [], remove: ["kanban:in-review"] });
  assert.deepEqual(labelChanges(["kanban:in-review"], "done"), { add: [], remove: ["kanban:in-review"] });
  assert.deepEqual(labelChanges(["kanban:in-review"], "in-review"), { add: [], remove: [] });
});
