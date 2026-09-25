// No imports: the test runs this file directly under Node's type stripping.

// The board has no storage of its own. A card is a GitHub issue and its column
// is derived from the issue: closed = done, an open linked pull request = in
// review, otherwise its kanban label, else todo.
export const COLUMNS = [
  { id: "todo", title: "To do", label: null },
  { id: "in-progress", title: "In progress", label: "kanban:in-progress" },
  { id: "in-review", title: "In review", label: "kanban:in-review" },
  { id: "done", title: "Done", label: null },
] as const;

export type ColumnId = (typeof COLUMNS)[number]["id"];

export const KANBAN_LABELS: readonly string[] = COLUMNS.flatMap((c) => (c.label ? [c.label] : []));

// Hides a done card without changing why the issue was closed.
export const ARCHIVED_LABEL = "kanban:archived";

export function columnFor(issue: { state: string; labels: readonly string[]; hasOpenPullRequest?: boolean }): ColumnId {
  if (issue.state.toUpperCase() === "CLOSED") return "done";
  // A pull request that will close the issue ("Closes #N") means it's in review,
  // whatever the labels say. Merging closes the issue, which makes it done.
  if (issue.hasOpenPullRequest) return "in-review";
  // Later columns win when an issue carries more than one kanban label.
  for (const column of [...COLUMNS].reverse()) {
    if (column.label && issue.labels.includes(column.label)) return column.id;
  }
  return "todo";
}

// Label edits that put an issue in `target`. Open/close is handled separately.
export function labelChanges(
  current: readonly string[],
  target: ColumnId,
): { add: string[]; remove: string[] } {
  const wanted = COLUMNS.find((c) => c.id === target)?.label ?? null;
  return {
    add: wanted && !current.includes(wanted) ? [wanted] : [],
    remove: current.filter((l) => KANBAN_LABELS.includes(l) && l !== wanted),
  };
}
