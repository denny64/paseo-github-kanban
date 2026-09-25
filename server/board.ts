import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import {
  archiveCardRpc,
  createCardRpc,
  loadBoardRpc,
  moveCardRpc,
} from "../shared/board";
import { ARCHIVED_LABEL, KANBAN_LABELS, columnFor, labelChanges } from "../shared/columns";
import { gh } from "./gh";

const ISSUE_FIELDS = "number,title,body,url,state,stateReason,labels,assignees,updatedAt,closedByPullRequestsReferences";
const reposWithLabels = new Set<string>();
// ponytail: a checkout's GitHub remote is resolved once per daemon process;
// `paseo plugin reload` picks up a changed remote.
const repoByCwd = new Map<string, RpcOutput<typeof loadBoardRpc>["repo"]>();

type RawIssue = {
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: string;
  stateReason: string | null;
  labels: { name: string; color: string }[];
  assignees: { login: string }[];
  updatedAt: string;
  // Open pull requests that will close this issue when merged.
  closedByPullRequestsReferences?: { number: number }[];
};

function toCard(raw: RawIssue): RpcOutput<typeof createCardRpc> {
  const labelNames = raw.labels.map((label) => label.name);
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? "",
    url: raw.url,
    column: columnFor({
      state: raw.state,
      labels: labelNames,
      hasOpenPullRequest: (raw.closedByPullRequestsReferences?.length ?? 0) > 0,
    }),
    labels: raw.labels
      .filter((label) => !KANBAN_LABELS.includes(label.name) && label.name !== ARCHIVED_LABEL)
      .map(({ name, color }) => ({ name, color })),
    assignees: raw.assignees.map((assignee) => assignee.login),
    updatedAt: raw.updatedAt,
  };
}

export async function loadBoard(
  { cwd }: RpcInput<typeof loadBoardRpc>,
): Promise<RpcOutput<typeof loadBoardRpc>> {
  let repo = repoByCwd.get(cwd);
  if (!repo) {
    try {
      repo = JSON.parse(await gh(["repo", "view", "--json", "nameWithOwner,url"], cwd)) as RpcOutput<typeof loadBoardRpc>["repo"];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`No GitHub repository found for this project: ${message}`);
    }
    repoByCwd.set(cwd, repo);
  }

  // ponytail: capped at 500 open + 30 closed issues; paginate if a board outgrows that.
  const [openOutput, closedOutput] = await Promise.all([
    listIssues(repo.nameWithOwner, "open", 500),
    listIssues(repo.nameWithOwner, "closed", 30),
  ]);
  const openIssues = JSON.parse(openOutput) as RawIssue[];
  const closedIssues = (JSON.parse(closedOutput) as RawIssue[]).filter(
    (issue) => issue.stateReason !== "NOT_PLANNED" && issue.stateReason !== "DUPLICATE",
  );
  const cards = [...openIssues, ...closedIssues]
    .filter((issue) => !issue.labels.some((label) => label.name === ARCHIVED_LABEL))
    .map(toCard)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return { repo, cards };
}

function listIssues(repo: string, state: "open" | "closed", limit: number): Promise<string> {
  return gh(["issue", "list", "--repo", repo, "--state", state, "--limit", String(limit), "--json", ISSUE_FIELDS]);
}

export async function createCard(
  { repo, title, body }: RpcInput<typeof createCardRpc>,
): Promise<RpcOutput<typeof createCardRpc>> {
  const url = await gh(["issue", "create", "--repo", repo, "--title", title, "--body", body]);
  const match = url.trim().match(/\/(\d+)\/?$/);
  if (!match) throw new Error(`Could not parse issue number from GitHub CLI output: ${url.trim()}`);

  const issue = JSON.parse(
    await gh(["issue", "view", match[1], "--repo", repo, "--json", ISSUE_FIELDS]),
  ) as RawIssue;
  return toCard(issue);
}

const LABELS = [
  { name: "kanban:in-progress", color: "FBCA04", description: "Kanban: in progress" },
  { name: "kanban:in-review", color: "8250DF", description: "Kanban: in review" },
  { name: ARCHIVED_LABEL, color: "D0D7DE", description: "Kanban: archived, hidden from the board" },
];

export async function ensureLabels(repo: string): Promise<void> {
  if (reposWithLabels.has(repo)) return;
  await Promise.all(
    LABELS.map((l) =>
      gh(["label", "create", l.name, "--repo", repo, "--color", l.color, "--description", l.description, "--force"]),
    ),
  );
  reposWithLabels.add(repo);
}

export async function moveCard(
  { repo, number, column }: RpcInput<typeof moveCardRpc>,
): Promise<RpcOutput<typeof moveCardRpc>> {
  const current = JSON.parse(
    await gh(["issue", "view", String(number), "--repo", repo, "--json", "state,labels"]),
  ) as Pick<RawIssue, "state" | "labels">;
  const currentLabelNames = current.labels.map((label) => label.name);
  const { add, remove } = labelChanges(currentLabelNames, column);

  if (add.length > 0) await ensureLabels(repo);

  if (column === "done" && current.state.toUpperCase() === "OPEN") {
    await gh(["issue", "close", String(number), "--repo", repo, "--reason", "completed"]);
  } else if (column !== "done" && current.state.toUpperCase() === "CLOSED") {
    await gh(["issue", "reopen", String(number), "--repo", repo]);
  }

  if (add.length > 0 || remove.length > 0) {
    const args = ["issue", "edit", String(number), "--repo", repo];
    if (add.length > 0) args.push("--add-label", add.join(","));
    if (remove.length > 0) args.push("--remove-label", remove.join(","));
    await gh(args);
  }

  const issue = JSON.parse(
    await gh(["issue", "view", String(number), "--repo", repo, "--json", ISSUE_FIELDS]),
  ) as RawIssue;
  return toCard(issue);
}

export async function archiveCard(
  { repo, number }: RpcInput<typeof archiveCardRpc>,
): Promise<RpcOutput<typeof archiveCardRpc>> {
  const { state } = JSON.parse(
    await gh(["issue", "view", String(number), "--repo", repo, "--json", "state"]),
  ) as Pick<RawIssue, "state">;
  if (state.toUpperCase() === "CLOSED") {
    // Already done: hide it with a label so GitHub still says it was completed.
    await ensureLabels(repo);
    await gh(["issue", "edit", String(number), "--repo", repo, "--add-label", ARCHIVED_LABEL]);
  } else {
    await gh(["issue", "close", String(number), "--repo", repo, "--reason", "not planned"]);
  }
  return {};
}
