import type { PaseoApi } from "@getpaseo/client";
import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { cancelScheduleRpc, createScheduleRpc, listSchedulesRpc, Schedule } from "../shared/board";
import { type AgentConfig, startAgent } from "../shared/start-agent";
import { moveCard } from "./board";

type Stored = Schedule & Omit<RpcInput<typeof createScheduleRpc>, "repo" | "runAt">;

// ponytail: one JSON file in the daemon's home; plugin settings are read-only
// on the daemon, and the daemon has to mark runs done.
const FILE = join(process.env.PASEO_HOME ?? join(homedir(), ".paseo"), "plugin-data", "paseo-github-kanban", "schedules.json");

// Plugins only get the Paseo API inside RPCs and hooks, so keep the latest one
// for the timer. After a daemon restart, due runs wait until the board loads or
// an agent event arrives, then start late.
let paseo: Pick<PaseoApi, "workspaces"> | null = null;
export function rememberPaseo(context: { paseo: PaseoApi }) {
  paseo = context.paseo;
}

// Serialise file access so the timer and RPCs never write over each other.
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(task: (list: Stored[]) => Promise<{ list?: Stored[]; result: T }>): Promise<T> {
  const run = queue.then(async () => {
    const list: Stored[] = await readFile(FILE, "utf8").then(JSON.parse, () => []);
    const { list: next, result } = await task(list);
    if (next) {
      await mkdir(dirname(FILE), { recursive: true });
      await writeFile(FILE, JSON.stringify(next, null, 2));
    }
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

const summary = ({ id, repo, number, runAt, error }: Stored): Schedule => ({ id, repo, number, runAt, error });

export function createSchedule(
  input: RpcInput<typeof createScheduleRpc>,
  context: { paseo: PaseoApi },
): Promise<RpcOutput<typeof createScheduleRpc>> {
  rememberPaseo(context);
  const schedule: Stored = { ...input, number: input.card.number, id: randomUUID(), error: null };
  // One schedule per card: a new time replaces the old one.
  return locked(async (list) => ({
    list: [...list.filter((s) => !(s.repo === input.repo && s.number === input.card.number)), schedule],
    result: summary(schedule),
  }));
}

export function listSchedules(
  _input: RpcInput<typeof listSchedulesRpc>,
  context: { paseo: PaseoApi },
): Promise<RpcOutput<typeof listSchedulesRpc>> {
  rememberPaseo(context);
  return locked(async (list) => ({ result: { schedules: list.map(summary) } }));
}

export function cancelSchedule({ id }: RpcInput<typeof cancelScheduleRpc>): Promise<RpcOutput<typeof cancelScheduleRpc>> {
  return locked(async (list) => ({ list: list.filter((s) => s.id !== id), result: {} }));
}

let running = false;
export async function runDueSchedules() {
  if (running || !paseo) return;
  running = true;
  try {
    for (;;) {
      // Take the next due run out of the file first, so it can't start twice.
      const due = await locked(async (list) => {
        const next = list.find((s) => !s.error && Date.parse(s.runAt) <= Date.now());
        return { list: next ? list.filter((s) => s !== next) : undefined, result: next };
      });
      if (!due) return;
      try {
        await startAgent(paseo, { ...due, config: due.config as AgentConfig });
        await moveCard({ repo: due.repo, number: due.number, column: "in-progress" }).catch(() => {});
      } catch (error) {
        const failed = { ...due, error: error instanceof Error ? error.message : String(error) };
        await locked(async (list) => ({ list: [...list, failed], result: null }));
      }
    }
  } finally {
    running = false;
  }
}
