import type { PaseoProject } from "@getpaseo/client";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { usePaseo, useRpc, useSettings } from "@getpaseo/plugin/client";
import { Icon, Modal, ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  boardSettings,
  type Card,
  COLUMNS,
  type ColumnId,
  loadBoardRpc,
  moveCardRpc,
  type Repo,
} from "../shared/board";
import { Button, columnColor, errorMessage, LabelPill, type Theme } from "./controls";
import { CardModal } from "./card-modal";
import { NewCardModal } from "./new-card-modal";

type Board = { repo: Repo; cards: Card[] };

export function BoardSurface({ theme, layout, navigation }: PluginSurfaceProps) {
  const paseo = usePaseo();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useSettings(boardSettings);
  const loadBoard = useRpc(loadBoardRpc);
  const moveCard = useRpc(moveCardRpc);

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () =>
      (await paseo.projects.list()).projects.filter((p) => p.projectKind === "git"),
  });
  useEffect(
    () => paseo.projects.subscribe(() => queryClient.invalidateQueries({ queryKey: ["projects"] })),
    [paseo, queryClient],
  );

  const savedProjectId = settings.status === "ready" ? settings.values.projectId : null;
  const project =
    settings.status === "loading"
      ? undefined
      : (projects.data?.find((p) => p.projectId === savedProjectId) ?? projects.data?.[0]);

  const boardKey = ["board", project?.projectRootPath];
  const board = useQuery({
    queryKey: boardKey,
    queryFn: () => loadBoard({ cwd: project!.projectRootPath }),
    enabled: !!project,
    refetchInterval: 60_000,
  });

  const putCard = (card: Card) =>
    queryClient.setQueryData<Board>(boardKey, (b) =>
      b && {
        ...b,
        cards: b.cards.some((c) => c.number === card.number)
          ? b.cards.map((c) => (c.number === card.number ? card : c))
          : [card, ...b.cards],
      },
    );

  const move = useMutation({
    mutationFn: moveCard,
    onMutate: async ({ number, column }) => {
      await queryClient.cancelQueries({ queryKey: boardKey });
      const previous = queryClient.getQueryData<Board>(boardKey);
      const card = previous?.cards.find((c) => c.number === number);
      if (card) putCard({ ...card, column });
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(boardKey, context?.previous);
      toast.error(`Couldn't move the card: ${errorMessage(error)}`);
    },
    onSuccess: putCard,
  });

  const [openCard, setOpenCard] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [pickingProject, setPickingProject] = useState(false);
  const [compactColumn, setCompactColumn] = useState<ColumnId>("todo");

  const byColumn = useMemo(() => {
    const groups = new Map<ColumnId, Card[]>(COLUMNS.map((c) => [c.id, []]));
    for (const card of board.data?.cards ?? []) groups.get(card.column)!.push(card);
    return groups;
  }, [board.data]);

  const styles = useMemo(
    () => ({
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      header: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        alignItems: "center" as const,
        gap: 8,
        paddingHorizontal: layout.compact ? 16 : 24,
        paddingTop: layout.compact ? 12 : 20,
        paddingBottom: 12,
      },
      projectButton: { flexShrink: 1, gap: 2 },
      projectRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
      projectName: { color: theme.colors.foreground, fontSize: layout.compact ? 18 : 20, fontWeight: "600" as const },
      muted: { color: theme.colors.foregroundMuted, fontSize: 12 },
      spacer: { flex: 1 },
      message: { padding: layout.compact ? 16 : 24, gap: 12, alignItems: "flex-start" as const },
      messageText: { color: theme.colors.foregroundMuted, fontSize: 14 },
      columns: { flex: 1, flexDirection: "row" as const, gap: 16, paddingHorizontal: 24, paddingBottom: 16 },
      tabs: { flexGrow: 0, paddingHorizontal: 16 },
      tabsContent: { gap: 8, paddingBottom: 8 },
    }),
    [theme, layout.compact],
  );

  const selectProject = (project: PaseoProject) => {
    setPickingProject(false);
    if (settings.status === "ready") {
      void settings.save({ ...settings.values, projectId: project.projectId }, settings.revision);
    }
  };

  let body: React.ReactNode;
  if (projects.isError) {
    body = <Message styles={styles} text={errorMessage(projects.error)} />;
  } else if (projects.data && projects.data.length === 0) {
    body = <Message styles={styles} text="Add a git project in Paseo to get a board for its GitHub issues." />;
  } else if (board.isError) {
    body = (
      <Message styles={styles} text={errorMessage(board.error)}>
        <Button theme={theme} label="Try again" icon="RotateCw" onPress={() => board.refetch()} />
      </Message>
    );
  } else if (!board.data) {
    body = <Message styles={styles} text="Loading issues…" />;
  } else if (layout.compact) {
    body = (
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
          {COLUMNS.map((column) => (
            <ColumnTab
              key={column.id}
              theme={theme}
              column={column.id}
              title={column.title}
              count={byColumn.get(column.id)!.length}
              selected={compactColumn === column.id}
              onPress={() => setCompactColumn(column.id)}
            />
          ))}
        </ScrollView>
        <Column theme={theme} cards={byColumn.get(compactColumn)!} onOpen={setOpenCard} compact />
      </>
    );
  } else {
    body = (
      <View style={styles.columns}>
        {COLUMNS.map((column) => (
          <Column
            key={column.id}
            theme={theme}
            column={column.id}
            title={column.title}
            cards={byColumn.get(column.id)!}
            onOpen={setOpenCard}
          />
        ))}
      </View>
    );
  }

  const card = board.data?.cards.find((c) => c.number === openCard);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose project"
          onPress={() => setPickingProject(true)}
          style={styles.projectButton}
        >
          <View style={styles.projectRow}>
            <Text style={styles.projectName} numberOfLines={1}>
              {project?.projectDisplayName ?? "Kanban"}
            </Text>
            <Icon name="ChevronDown" size={16} color={theme.colors.foregroundMuted} />
          </View>
          {board.data ? <Text style={styles.muted}>{board.data.repo.nameWithOwner} · GitHub issues</Text> : null}
        </Pressable>
        <View style={styles.spacer} />
        <Button
          theme={theme}
          icon="RotateCw"
          accessibilityLabel="Refresh"
          disabled={!project || board.isFetching}
          onPress={() => board.refetch()}
        />
        <Button theme={theme} label="New card" icon="Plus" primary disabled={!board.data} onPress={() => setCreating(true)} />
      </View>

      {body}

      <Modal title="Choose project" open={pickingProject} onOpenChange={setPickingProject}>
        <Modal.Content>
          {(projects.data ?? []).map((p) => (
            <ProjectRow key={p.projectId} theme={theme} project={p} selected={p.projectId === project?.projectId} onPress={() => selectProject(p)} />
          ))}
        </Modal.Content>
      </Modal>

      {board.data && project ? (
        <NewCardModal
          theme={theme}
          open={creating}
          repo={board.data.repo.nameWithOwner}
          onOpenChange={setCreating}
          onCreated={putCard}
        />
      ) : null}

      {card && board.data && project ? (
        <CardModal
          theme={theme}
          card={card}
          repo={board.data.repo.nameWithOwner}
          project={project}
          onClose={() => setOpenCard(null)}
          onMove={(column) => move.mutate({ repo: board.data!.repo.nameWithOwner, number: card.number, column })}
          onAgentStarted={(agentId) => {
            setOpenCard(null);
            move.mutate({ repo: board.data!.repo.nameWithOwner, number: card.number, column: "in-progress" });
            navigation?.openAgent({ agentId });
          }}
        />
      ) : null}
    </View>
  );
}

function Message({
  styles,
  text,
  children,
}: {
  styles: { message: object; messageText: object };
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.message}>
      <Text style={styles.messageText}>{text}</Text>
      {children}
    </View>
  );
}

function Column({
  theme,
  column,
  title,
  cards,
  compact,
  onOpen,
}: {
  theme: Theme;
  column?: ColumnId;
  title?: string;
  cards: Card[];
  compact?: boolean;
  onOpen(number: number): void;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
      {column && title ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: columnColor(theme, column) }} />
          <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600" }}>{title}</Text>
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>{cards.length}</Text>
        </View>
      ) : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: compact ? 16 : 0, paddingBottom: 16 }}
      >
        {cards.length === 0 ? (
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13, paddingVertical: 8 }}>No cards</Text>
        ) : (
          cards.map((card) => <CardTile key={card.number} theme={theme} card={card} onPress={() => onOpen(card.number)} />)
        )}
      </ScrollView>
    </View>
  );
}

function CardTile({ theme, card, onPress }: { theme: Theme; card: Card; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Issue ${card.number}: ${card.title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        gap: 6,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surface2 : theme.colors.surface1,
      })}
    >
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>#{card.number}</Text>
      <Text style={{ color: theme.colors.foreground, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
        {card.title}
      </Text>
      {card.labels.length > 0 || card.assignees.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {card.labels.map((label) => (
            <LabelPill key={label.name} theme={theme} name={label.name} color={label.color} />
          ))}
          {card.assignees.map((login) => (
            <Text key={login} style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
              @{login}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function ColumnTab({
  theme,
  column,
  title,
  count,
  selected,
  onPress,
}: {
  theme: Theme;
  column: ColumnId;
  title: string;
  count: number;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${count} cards`}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: selected ? theme.colors.surface2 : "transparent",
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: columnColor(theme, column) }} />
      <Text style={{ color: selected ? theme.colors.foreground : theme.colors.foregroundMuted, fontSize: 13 }}>
        {title} {count}
      </Text>
    </Pressable>
  );
}

function ProjectRow({
  theme,
  project,
  selected,
  onPress,
}: {
  theme: Theme;
  project: PaseoProject;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={project.projectDisplayName}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 8,
        backgroundColor: pressed || selected ? theme.colors.surface2 : "transparent",
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>{project.projectDisplayName}</Text>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }} numberOfLines={1}>
          {project.projectRootPath}
        </Text>
      </View>
      {selected ? <Icon name="Check" size={16} color={theme.colors.accent} /> : null}
    </Pressable>
  );
}
