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

export const boardSettings = defineSettings({
  id: "board",
  scope: "host",
  version: 1,
  schema: z.object({
    // Last opened Paseo project, so the board reopens where you left it.
    projectId: z.string().nullable().default(null),
    // Last agent used from "Start agent": "profile:<id>" or "model:<provider>/<model>".
    agent: z.string().nullable().default(null),
    view: z.enum(["board", "list"]).default("board"),
  }),
});
