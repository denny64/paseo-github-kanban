import type { PaseoAgentConfig, PaseoApi } from "./paseo-types";
import { usePaseo, useSettings } from "@getpaseo/plugin/client";
import { Modal, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { ExternalLink, SettingsCard, SettingsSelect } from "@getpaseo/plugin/client/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";
import { boardSettings, type Card, COLUMNS, type ColumnId } from "../shared/board";
import { Button, errorMessage, inputStyle, LabelPill, type Theme } from "./controls";
import type { BoardCard } from "./use-boards";

export function agentPrompt(card: Card, repo: string): string {
  return [
    `Work on GitHub issue #${card.number} in ${repo}: ${card.title}`,
    "The issue is attached.",
    "",
    "When you're done:",
    `1. Commit your work and open a pull request whose description includes "Closes #${card.number}".`,
    `2. Move the card to review: gh issue edit ${card.number} --repo ${repo} --add-label kanban:in-review --remove-label kanban:in-progress`,
  ].join("\n");
}

type AgentOption = { value: string; label: string; config: PaseoAgentConfig };

// Your Paseo agent profiles first (they carry mode and thinking level), then
// every model of every ready provider, default model first.
async function loadAgentOptions(paseo: PaseoApi, cwd: string) {
  const [{ config }, { entries }] = await Promise.all([paseo.config.get(), paseo.providers.snapshot({ cwd })]);
  const ready = entries.filter((entry) => entry.enabled !== false && entry.status === "ready");
  const readyIds = new Set(ready.map((entry) => entry.provider));
  const profiles: AgentOption[] = (config.agentProfiles ?? [])
    .filter((profile) => readyIds.has(profile.provider))
    .map((profile) => ({
      value: `profile:${profile.id}`,
      label: profile.name,
      config: {
        provider: profile.model ? `${profile.provider}/${profile.model}` : profile.provider,
        modeId: profile.modeId,
        thinkingOptionId: profile.thinkingOptionId,
        featureValues: profile.featureValues,
      },
    }));
  const models: AgentOption[] = ready.flatMap((entry) =>
    (entry.models ?? [])
      .filter((model) => model.isSelectable !== false)
      .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault))
      .map((model) => ({
        value: `model:${entry.provider}/${model.id}`,
        label: `${entry.label ?? entry.provider} · ${model.label}`,
        config: { provider: `${entry.provider}/${model.id}` },
      })),
  );
  return { options: [...profiles, ...models], loading: entries.some((entry) => entry.status === "loading") };
}

export function CardModal({
  theme,
  card,
  reference,
  onClose,
  onMove,
  onAgentStarted,
}: {
  theme: Theme;
  card: BoardCard;
  reference: string;
  onClose(): void;
  onMove(column: ColumnId): void;
  onAgentStarted(agentId: string): void;
}) {
  const heading = { color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "600" as const };
  return (
    <Modal title={reference} open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Text style={{ color: theme.colors.foreground, fontSize: 18, fontWeight: "600", lineHeight: 24 }} selectable>
          {card.title}
        </Text>
        {card.labels.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {card.labels.map((label) => (
              <LabelPill key={label.name} theme={theme} name={label.name} color={label.color} />
            ))}
          </View>
        ) : null}
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
  const { project } = card;
  const repo = card.repo.nameWithOwner;
  const paseo = usePaseo();
  const toast = useToast();
  const settings = useSettings(boardSettings);
  const agents = useQuery({
    queryKey: ["agents", project.projectRootPath],
    queryFn: () => loadAgentOptions(paseo, project.projectRootPath),
    refetchInterval: (query) => (query.state.data?.loading ? 2_000 : false),
  });
  const [picked, setPicked] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(() => agentPrompt(card, repo));

  const options = agents.data?.options ?? [];
  const saved = settings.status === "ready" ? settings.values.agent : null;
  const agent = options.find((o) => o.value === (picked ?? saved)) ?? options[0];

  const start = useMutation({
    mutationFn: async (agent: AgentOption) => {
      // A fresh worktree per card, so several agents can work the board at once.
      const workspace = await paseo.workspaces.create({
        title: `#${card.number} ${card.title}`,
        source: { kind: "worktree", cwd: project.projectRootPath, projectId: project.projectId, action: "branch-off" },
        firstAgentContext: { prompt },
      });
      const created = await workspace.agents.create({
        config: agent.config,
        prompt,
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
    },
    onSuccess: (agentId, agent) => {
      if (settings.status === "ready" && settings.values.agent !== agent.value) {
        void settings.save({ ...settings.values, agent: agent.value }, settings.revision);
      }
      onStarted(agentId);
    },
    onError: (error) => toast.error(`Couldn't start the agent: ${errorMessage(error)}`),
  });

  return (
    <View style={{ gap: 8 }}>
      {showHeading ? (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "600" }}>START AN AGENT</Text>
      ) : null}
      {agent ? (
        <SettingsCard>
          <SettingsSelect
            label="Agent"
            hint="Runs in a new worktree with this issue attached."
            value={agent.value}
            options={options}
            onValueChange={setPicked}
          />
        </SettingsCard>
      ) : (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>
          {agents.isError ? errorMessage(agents.error) : agents.isLoading || agents.data?.loading ? "Loading agents…" : "No agents are ready on this host."}
        </Text>
      )}
      <TextInput
        accessibilityLabel="First message"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        style={inputStyle(theme, true)}
        placeholderTextColor={theme.colors.foregroundMuted}
      />
      <View style={{ flexDirection: "row" }}>
        <Button
          theme={theme}
          label={start.isPending ? "Starting…" : "Start agent"}
          icon="Play"
          primary
          disabled={!agent || !prompt.trim() || start.isPending}
          onPress={() => agent && start.mutate(agent)}
        />
      </View>
    </View>
  );
}
