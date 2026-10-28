import type { PaseoAgentConfig, PaseoApi } from "./paseo-types";
import { usePaseo, useSettings } from "@getpaseo/plugin/client";
import { Modal, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { ExternalLink, SettingsCard, SettingsSelect } from "@getpaseo/plugin/client/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";
import { boardSettings, type Card, COLUMNS, type ColumnId } from "../shared/board";
import { Button, errorMessage, inputStyle, LabelPill, RepoTag, type Theme } from "./controls";
import { type AgentImage, ImageAttachments, useImages } from "./images";
import { type BoardCard, repoName } from "./use-boards";

export function agentPrompt(card: Card, repo: string): string {
  return [
    `Work on GitHub issue #${card.number} in ${repo}: ${card.title}`,
    "The issue is attached.",
    "",
    "When you're done:",
    `Commit your work and open a pull request whose description includes "Closes #${card.number}".`,
  ].join("\n");
}

type Choice = { value: string; label: string };
type AgentOption = Choice & { config: PaseoAgentConfig; thinking: Choice[]; defaultThinking?: string };

// ponytail: hand-picked "provider/model", in menu order; edit when a new model ships.
const PINNED_MODELS = ["claude/claude-fable-5-1", "claude/claude-opus-5-5", "codex/gpt-6-astra", "codex/gpt-5.6-sol"];

type Model = NonNullable<Awaited<ReturnType<PaseoApi["providers"]["snapshot"]>>["entries"][number]["models"]>[number];

const thinkingOf = (model: Model | undefined) => ({
  thinking: (model?.thinkingOptions ?? []).map((option) => ({ value: option.id, label: option.label })),
  defaultThinking: model?.defaultThinkingOptionId ?? model?.thinkingOptions?.find((option) => option.isDefault)?.id,
});

// Your Paseo agent profiles (they carry mode and feature settings), then the
// pinned models no profile already covers, in PINNED_MODELS order.
async function loadAgentOptions(paseo: PaseoApi, cwd: string) {
  const [{ config }, { entries }] = await Promise.all([paseo.config.get(), paseo.providers.snapshot({ cwd })]);
  const ready = entries.filter((entry) => entry.enabled !== false && entry.status === "ready");
  const readyIds = new Set(ready.map((entry) => entry.provider));
  const models = new Map<string, { entry: (typeof ready)[number]; model: Model }>(
    ready.flatMap((entry) => (entry.models ?? []).map((model) => [`${entry.provider}/${model.id}`, { entry, model }])),
  );
  const profiles = (config.agentProfiles ?? [])
    .filter((profile) => readyIds.has(profile.provider))
    .map((profile) => {
      const key = profile.model ? `${profile.provider}/${profile.model}` : profile.provider;
      const { thinking, defaultThinking } = thinkingOf(models.get(key)?.model);
      return {
        key,
        value: `profile:${profile.id}`,
        label: profile.name,
        config: {
          provider: key,
          modeId: profile.modeId,
          thinkingOptionId: profile.thinkingOptionId,
          featureValues: profile.featureValues,
        },
        thinking,
        defaultThinking: profile.thinkingOptionId ?? defaultThinking,
      };
    });
  const pinned = PINNED_MODELS.filter((key) => models.has(key) && !profiles.some((p) => p.key === key)).map((key) => {
    const { entry, model } = models.get(key)!;
    return {
      key,
      value: `model:${key}`,
      label: `${entry.label ?? entry.provider} · ${model.label}`,
      config: { provider: key },
      ...thinkingOf(model),
    };
  });
  // Profiles for unpinned models go last.
  const rank = (key: string) => (PINNED_MODELS.includes(key) ? PINNED_MODELS.indexOf(key) : PINNED_MODELS.length);
  const options: AgentOption[] = [...profiles, ...pinned].sort((a, b) => rank(a.key) - rank(b.key));
  return { options, loading: entries.some((entry) => entry.status === "loading") };
}

// Agent and thinking level for a new agent in `cwd`, defaulting to the last ones started.
export function useAgentPicker(cwd: string) {
  const paseo = usePaseo();
  const settings = useSettings(boardSettings);
  const query = useQuery({
    queryKey: ["agents", cwd],
    queryFn: () => loadAgentOptions(paseo, cwd),
    refetchInterval: (query) => (query.state.data?.loading ? 2_000 : false),
  });
  const [pickedAgent, setAgent] = useState<string | null>(null);
  const [pickedThinking, setThinking] = useState<string | null>(null);

  const options = query.data?.options ?? [];
  const saved = settings.status === "ready" ? settings.values : null;
  const agent = options.find((o) => o.value === (pickedAgent ?? saved?.agent)) ?? options[0];
  // A level the new model doesn't have falls back to its default.
  const thinking =
    agent?.thinking.find((t) => t.value === (pickedThinking ?? saved?.thinking))?.value ??
    agent?.defaultThinking ??
    agent?.thinking[0]?.value;
  const config = agent && (thinking ? { ...agent.config, thinkingOptionId: thinking } : agent.config);

  const remember = () => {
    if (settings.status !== "ready" || !agent) return;
    const values = { ...settings.values, agent: agent.value, thinking: thinking ?? settings.values.thinking };
    if (values.agent !== settings.values.agent || values.thinking !== settings.values.thinking) {
      void settings.save(values, settings.revision);
    }
  };

  return { query, options, agent, thinking, config, setAgent, setThinking, remember };
}

export function AgentPicker({ theme, picker }: { theme: Theme; picker: ReturnType<typeof useAgentPicker> }) {
  const { query, options, agent, thinking } = picker;
  if (!agent) {
    return (
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>
        {query.isError ? errorMessage(query.error) : query.isLoading || query.data?.loading ? "Loading agents…" : "No agents are ready on this host."}
      </Text>
    );
  }
  return (
    <SettingsCard>
      <SettingsSelect
        label="Agent"
        hint="Runs in a new worktree with this issue attached."
        value={agent.value}
        options={options}
        onValueChange={picker.setAgent}
      />
      {thinking ? (
        <SettingsSelect label="Thinking" value={thinking} options={agent.thinking} onValueChange={picker.setThinking} />
      ) : null}
    </SettingsCard>
  );
}

// A fresh worktree per card, so several agents can work the board at once.
export async function startAgentOn(
  paseo: PaseoApi,
  card: BoardCard,
  config: PaseoAgentConfig,
  prompt: string,
  images: AgentImage[],
) {
  const { project } = card;
  const workspace = await paseo.workspaces.create({
    title: `#${card.number} ${card.title}`,
    source: { kind: "worktree", cwd: project.projectRootPath, projectId: project.projectId, action: "branch-off" },
    firstAgentContext: { prompt },
  });
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
}

export function CardModal({
  theme,
  card,
  reference,
  onClose,
  onMove,
  onArchive,
  onAgentStarted,
}: {
  theme: Theme;
  card: BoardCard;
  reference: string;
  onClose(): void;
  onMove(column: ColumnId): void;
  onArchive(): void;
  onAgentStarted(agentId: string): void;
}) {
  const heading = { color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "600" as const };
  return (
    <Modal title={reference} open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Text style={{ color: theme.colors.foreground, fontSize: 18, fontWeight: "600", lineHeight: 24 }} selectable>
          {card.title}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <RepoTag theme={theme} name={repoName(card)} />
          {card.labels.map((label) => (
            <LabelPill key={label.name} theme={theme} name={label.name} color={label.color} />
          ))}
        </View>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14, lineHeight: 20 }} selectable>
          {card.body.trim() || "No description."}
        </Text>
        <ExternalLink href={card.url}>Open on GitHub</ExternalLink>

        <View style={{ gap: 8 }}>
          <Text style={heading}>COLUMN</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {COLUMNS.map((column) => (
              <Button
                key={column.id}
                theme={theme}
                label={column.title}
                primary={column.id === card.column}
                accessibilityLabel={`Move to ${column.title}`}
                onPress={() => column.id !== card.column && onMove(column.id)}
              />
            ))}
          </View>
        </View>

        {card.column !== "done" ? (
          <StartAgent theme={theme} card={card} onStarted={onAgentStarted} />
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={heading}>ISSUE</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {card.column !== "done" ? (
              <Button theme={theme} label="Close issue" icon="CircleCheck" onPress={() => onMove("done")} />
            ) : null}
            <Button theme={theme} label="Archive" icon="Archive" onPress={onArchive} />
          </View>
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
            {card.column === "done"
              ? "Archive hides this card with the kanban:archived label; the issue stays closed as completed."
              : "Archive closes the issue as not planned and hides it. Reopen it on GitHub to bring it back."}
          </Text>
        </View>
      </Modal.Content>
    </Modal>
  );
}

// "Start agent" straight from a card tile or list row, without the card view.
export function StartAgentModal({
  theme,
  card,
  reference,
  onClose,
  onStarted,
}: {
  theme: Theme;
  card: BoardCard;
  reference: string;
  onClose(): void;
  onStarted(agentId: string): void;
}) {
  return (
    <Modal title={`Start agent on ${reference}`} open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Text style={{ color: theme.colors.foreground, fontSize: 16, fontWeight: "600", lineHeight: 22 }}>{card.title}</Text>
        <StartAgent theme={theme} card={card} onStarted={onStarted} showHeading={false} />
      </Modal.Content>
    </Modal>
  );
}

function StartAgent({
  theme,
  card,
  onStarted,
  showHeading = true,
}: {
  theme: Theme;
  card: BoardCard;
  onStarted(agentId: string): void;
  showHeading?: boolean;
}) {
  const paseo = usePaseo();
  const toast = useToast();
  const picker = useAgentPicker(card.project.projectRootPath);
  const [prompt, setPrompt] = useState(() => agentPrompt(card, card.repo.nameWithOwner));
  const images = useImages(true, toast.error);

  const start = useMutation({
    mutationFn: (config: PaseoAgentConfig) => startAgentOn(paseo, card, config, prompt, images.images),
    onSuccess: (agentId) => {
      picker.remember();
      onStarted(agentId);
    },
    onError: (error) => toast.error(`Couldn't start the agent: ${errorMessage(error)}`),
  });
  const { config } = picker;

  return (
    <View style={{ gap: 8 }}>
      {showHeading ? (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "600" }}>START AN AGENT</Text>
      ) : null}
      <AgentPicker theme={theme} picker={picker} />
      <TextInput
        accessibilityLabel="First message"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        style={inputStyle(theme, true)}
        placeholderTextColor={theme.colors.foregroundMuted}
      />
      <ImageAttachments theme={theme} images={images} />
      <View style={{ flexDirection: "row" }}>
        <Button
          theme={theme}
          label={start.isPending ? "Starting…" : "Start agent"}
          icon="Play"
          primary
          disabled={!config || !prompt.trim() || start.isPending}
          onPress={() => config && start.mutate(config)}
        />
      </View>
    </View>
  );
}
