import type { PaseoApi } from "@getpaseo/client";
import type { Card } from "./board";

type Workspace = Awaited<ReturnType<PaseoApi["workspaces"]["create"]>>;
type AgentInput = Parameters<Workspace["agents"]["create"]>[0];
export type AgentConfig = AgentInput["config"];
export type AgentImages = NonNullable<AgentInput["images"]>;

// A fresh worktree per card, so several agents can work the board at once.
// Runs in the app for "Start agent" and on the daemon for scheduled starts.
export async function startAgent(
  paseo: Pick<PaseoApi, "workspaces">,
  {
    card,
    project,
    config,
    prompt,
    images = [],
  }: {
    card: Card;
    project: { projectId: string; projectRootPath: string };
    config: AgentConfig;
    prompt: string;
    images?: AgentImages;
  },
): Promise<string> {
  const workspace = await paseo.workspaces.create({
    title: `#${card.number} ${card.title}`,
    source: { kind: "worktree", cwd: project.projectRootPath, projectId: project.projectId, action: "branch-off" },
    firstAgentContext: { prompt },
  });
  try {
    const created = await workspace.agents.create({
      config,
      prompt,
      images,
      attachments: [
        {
          type: "github_issue",
          mimeType: "application/github-issue",
          number: card.number,
          title: card.title,
          url: card.url,
          body: card.body,
        },
      ],
    });
    return created.id;
  } catch (error) {
    // Don't leave an empty worktree behind for an agent that never started.
    await paseo.workspaces.archive(workspace).catch(() => {});
    throw error;
  }
}
