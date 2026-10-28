import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export { COLUMNS, type ColumnId } from "./columns";

export const columnIdSchema = z.enum(["todo", "in-progress", "in-review", "done"]);

export const cardSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  url: z.string(),
  column: columnIdSchema,
  // Non-kanban labels only; the kanban labels are expressed by `column`.
  labels: z.array(z.object({ name: z.string(), color: z.string() })),
  assignees: z.array(z.string()),
  updatedAt: z.string(),
});
export type Card = z.infer<typeof cardSchema>;

export const repoSchema = z.object({ nameWithOwner: z.string(), url: z.string() });
export type Repo = z.infer<typeof repoSchema>;

export const loadBoardRpc = defineRpc({
  name: "board.load",
  // Absolute path of the Paseo project checkout; its GitHub remote is the board.
  input: z.object({ cwd: z.string() }),
  output: z.object({ repo: repoSchema, cards: z.array(cardSchema) }),
});

export const createCardRpc = defineRpc({
  name: "card.create",
  input: z.object({
    repo: z.string(),
    title: z.string().trim().min(1),
    body: z.string(),
  }),
  output: cardSchema,
});

export const moveCardRpc = defineRpc({
  name: "card.move",
  input: z.object({
    repo: z.string(),
    number: z.number().int().positive(),
    column: columnIdSchema,
  }),
  output: cardSchema,
});

// Hide a card: an open issue is closed as "not planned"; a done one gets the
// kanban:archived label so its completed status stays. Both are hidden.
export const archiveCardRpc = defineRpc({
  name: "card.archive",
  input: z.object({ repo: z.string(), number: z.number().int().positive() }),
  output: z.object({}),
});

// An agent start waiting for its time. The daemon runs it, so it happens with
// Paseo closed. `error` is set when the start failed; the card shows it.
export const scheduleSchema = z.object({
  id: z.string(),
  repo: z.string(),
  number: z.number().int().positive(),
  runAt: z.string(),
  error: z.string().nullable(),
});
export type Schedule = z.infer<typeof scheduleSchema>;

export const createScheduleRpc = defineRpc({
  name: "schedule.create",
  input: z.object({
    repo: z.string(),
    card: cardSchema,
    runAt: z.string(),
    // The Paseo project the worktree branches from.
    project: z.object({ projectId: z.string(), projectRootPath: z.string() }),
    config: z.looseObject({ provider: z.string() }),
    prompt: z.string(),
  }),
  output: scheduleSchema,
});

export const listSchedulesRpc = defineRpc({
  name: "schedule.list",
  input: z.object({}),
  output: z.object({ schedules: z.array(scheduleSchema) }),
});

export const cancelScheduleRpc = defineRpc({
  name: "schedule.cancel",
  input: z.object({ id: z.string() }),
  output: z.object({}),
});

export const boardSettings = defineSettings({
  id: "board",
  scope: "host",
  version: 1,
  schema: z.object({
    // Last agent used from "Start agent": "profile:<id>" or "model:<provider>/<model>".
    agent: z.string().nullable().default(null),
    // Last thinking level picked for a model that offers them.
    thinking: z.string().nullable().default(null),
    view: z.enum(["board", "list"]).default("board"),
  }),
});
