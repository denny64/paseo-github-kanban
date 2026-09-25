import type { PaseoProject } from "./paseo-types";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { usePaseo, useSettings } from "@getpaseo/plugin/client";
import { Icon, Modal, ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { boardSettings, COLUMNS, type ColumnId } from "../shared/board";
import { CardModal, StartAgentModal } from "./card-modal";
import { Button, ColumnHeading, columnColor, errorMessage, IconButton, LabelPill, type Theme } from "./controls";
import { type CardDrag, DragOverlay, Draggable, useCardDrag } from "./drag";
import { ListView } from "./list-view";
import { NewCardModal } from "./new-card-modal";
import { type BoardCard, cardRef, useBoards, useMoveCard, usePutCard } from "./use-boards";

type ViewMode = "board" | "list";

export function BoardSurface({ theme, layout, navigation }: PluginSurfaceProps) {
  const paseo = usePaseo();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useSettings(boardSettings);

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () =>
      (await paseo.projects.list()).projects.filter((p) => p.projectKind === "git"),
  });
  useEffect(
    () => paseo.projects.subscribe(() => queryClient.invalidateQueries({ queryKey: ["projects"] })),
    [paseo, queryClient],
  );

  const values = settings.status === "ready" ? settings.values : null;
  const showAll = !!values?.allProjects;
  const project =
    settings.status === "loading"
      ? undefined
      : (projects.data?.find((p) => p.projectId === values?.projectId) ?? projects.data?.[0]);
  const scope = settings.status === "loading" ? [] : showAll ? (projects.data ?? []) : project ? [project] : [];

  // ponytail: one gh round trip per repo per refresh, so the all-projects view
  // polls every 5 min instead of every minute; move to a single GraphQL query if that bites.
  const boards = useBoards(scope, showAll ? 300_000 : 60_000);
  const putCard = usePutCard();
  const move = useMoveCard((error) => toast.error(`Couldn't move the card: ${errorMessage(error)}`));
  const drag = useCardDrag((card, column) => move.mutate({ card, column }));

  const [openCard, setOpenCard] = useState<string | null>(null);
  const [startFor, setStartFor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pickingProject, setPickingProject] = useState(false);
  const [compactColumn, setCompactColumn] = useState<ColumnId>("todo");
  // Local override so the toggle flips instantly; the saved setting catches up.
  const [viewOverride, setViewOverride] = useState<ViewMode | null>(null);
  const view = viewOverride ?? values?.view ?? "board";

  const byColumn = useMemo(() => {
    const groups = new Map<ColumnId, BoardCard[]>(COLUMNS.map((c) => [c.id, []]));
    for (const card of boards.cards) groups.get(card.column)!.push(card);
    return groups;
  }, [boards.cards]);

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
      notice: { color: theme.colors.foregroundMuted, fontSize: 12, paddingHorizontal: layout.compact ? 16 : 24, paddingBottom: 8 },
      columns: { flex: 1, flexDirection: "row" as const, gap: 16, paddingHorizontal: 24, paddingBottom: 16 },
      tabs: { flexGrow: 0, paddingHorizontal: 16 },
      tabsContent: { gap: 8, paddingBottom: 8 },
    }),
    [theme, layout.compact],
  );

  const saveSettings = (patch: Partial<NonNullable<typeof values>>) => {
    if (settings.status === "ready") void settings.save({ ...settings.values, ...patch }, settings.revision);
  };
  const selectProject = (next: PaseoProject | "all") => {
    setPickingProject(false);
    saveSettings(next === "all" ? { allProjects: true } : { allProjects: false, projectId: next.projectId });
  };
  const selectView = (next: ViewMode) => {
    setViewOverride(next);
    saveSettings({ view: next });
  };

  let body: React.ReactNode;
  if (projects.isError) {
    body = <Message styles={styles} text={errorMessage(projects.error)} />;
  } else if (projects.data && projects.data.length === 0) {
    body = <Message styles={styles} text="Add a git project in Paseo to get a board for its GitHub issues." />;
  } else if (boards.repos.length === 0 && boards.failed.length > 0 && !boards.fetching) {
    body = (
      <Message styles={styles} text={errorMessage(boards.failed[0].error)}>
        <Button theme={theme} label="Try again" icon="RotateCw" onPress={() => boards.refetch()} />
      </Message>
    );
  } else if (!boards.ready || scope.length === 0) {
    body = <Message styles={styles} text="Loading issues…" />;
  } else if (view === "list") {
    body = (
      <ListView
        theme={theme}
        compact={layout.compact}
        showRepo={showAll}
        byColumn={byColumn}
        onOpen={setOpenCard}
        onStartAgent={setStartFor}
      />
    );
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
              dropping={drag.hover === column.id && drag.dragging?.card.column !== column.id}
              dropRef={drag.target(column.id)}
              onPress={() => setCompactColumn(column.id)}
            />
          ))}
        </ScrollView>
        <Column
          theme={theme}
          cards={byColumn.get(compactColumn)!}
          showRepo={showAll}
          drag={drag}
          onOpen={setOpenCard}
          onStartAgent={setStartFor}
          compact
        />
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
            showRepo={showAll}
            drag={drag}
            onOpen={setOpenCard}
            onStartAgent={setStartFor}
          />
        ))}
      </View>
    );
  }

  const card = boards.cards.find((c) => c.key === openCard);
  const startCard = boards.cards.find((c) => c.key === startFor);
  const agentStarted = (started: BoardCard, agentId: string) => {
    setOpenCard(null);
    setStartFor(null);
    move.mutate({ card: started, column: "in-progress" });
    navigation?.openAgent({ agentId });
  };
  // Some repos loaded and some didn't: say which, without hiding the rest.
  const skipped = showAll && boards.repos.length > 0 ? boards.failed.map((f) => f.project.projectDisplayName) : [];

  return (
    <View ref={drag.rootRef} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose project"
          onPress={() => setPickingProject(true)}
          style={styles.projectButton}
        >
          <View style={styles.projectRow}>
            <Text style={styles.projectName} numberOfLines={1}>
              {showAll ? "All projects" : (project?.projectDisplayName ?? "Kanban")}
            </Text>
            <Icon name="ChevronDown" size={16} color={theme.colors.foregroundMuted} />
          </View>
          {boards.repos.length > 0 ? (
            <Text style={styles.muted}>
              {showAll
                ? `${boards.repos.length} ${boards.repos.length === 1 ? "repo" : "repos"} · GitHub issues`
                : `${boards.repos[0].repo.nameWithOwner} · GitHub issues`}
            </Text>
          ) : null}
        </Pressable>
        <View style={styles.spacer} />
        <ViewToggle theme={theme} view={view} onChange={selectView} />
        <Button
          theme={theme}
          icon="RotateCw"
          accessibilityLabel="Refresh"
          disabled={scope.length === 0 || boards.fetching}
          onPress={() => boards.refetch()}
        />
        <Button
          theme={theme}
          label="New card"
          icon="Plus"
          primary
          disabled={boards.repos.length === 0}
          onPress={() => setCreating(true)}
        />
      </View>

      {skipped.length > 0 ? (
        <Text style={styles.notice} numberOfLines={2}>
          Couldn't load {skipped.join(", ")}. Open {skipped.length === 1 ? "it" : "one"} on its own to see why.
        </Text>
      ) : null}

      {body}

      <Modal title="Choose project" open={pickingProject} onOpenChange={setPickingProject}>
        <Modal.Content>
          <ProjectRow
            theme={theme}
            title="All projects"
            subtitle="Every git project on this host, on one board"
            selected={showAll}
            onPress={() => selectProject("all")}
          />
          {(projects.data ?? []).map((p) => (
            <ProjectRow
              key={p.projectId}
              theme={theme}
              title={p.projectDisplayName}
              subtitle={p.projectRootPath}
              selected={!showAll && p.projectId === project?.projectId}
              onPress={() => selectProject(p)}
            />
          ))}
        </Modal.Content>
      </Modal>

      {boards.repos.length > 0 ? (
        <NewCardModal
          theme={theme}
          open={creating}
          targets={boards.repos}
          defaultProjectId={project?.projectId}
          onOpenChange={setCreating}
          onCreated={putCard}
        />
      ) : null}

      {card ? (
        <CardModal
          theme={theme}
          card={card}
          reference={cardRef(card, showAll)}
          onClose={() => setOpenCard(null)}
          onMove={(column) => move.mutate({ card, column })}
          onAgentStarted={(agentId) => agentStarted(card, agentId)}
        />
      ) : null}

      {startCard ? (
        <StartAgentModal
          theme={theme}
          card={startCard}
          reference={cardRef(startCard, showAll)}
          onClose={() => setStartFor(null)}
          onStarted={(agentId) => agentStarted(startCard, agentId)}
        />
      ) : null}

      <DragOverlay drag={drag}>{(dragged) => <CardTile theme={theme} card={dragged} showRepo={showAll} lifted />}</DragOverlay>
    </View>
  );
}

function ViewToggle({ theme, view, onChange }: { theme: Theme; view: ViewMode; onChange(view: ViewMode): void }) {
  const options = [
    { id: "board", icon: "Kanban", label: "Board view" },
    { id: "list", icon: "List", label: "List view" },
  ] as const;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 2,
        padding: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      }}
    >
      {options.map((option) => {
        const selected = option.id === view;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 6,
              borderRadius: 6,
              backgroundColor: selected ? theme.colors.surface2 : "transparent",
            }}
          >
            <Icon name={option.icon} size={14} color={selected ? theme.colors.foreground : theme.colors.foregroundMuted} />
          </Pressable>
        );
      })}
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
  showRepo,
  drag,
  compact,
  onOpen,
  onStartAgent,
}: {
  theme: Theme;
  column?: ColumnId;
  title?: string;
  cards: BoardCard[];
  showRepo: boolean;
  drag: CardDrag;
  compact?: boolean;
  onOpen(key: string): void;
  onStartAgent(key: string): void;
}) {
  const dropping = !!column && drag.hover === column && drag.dragging?.card.column !== column;
  return (
    <View
      ref={column ? drag.target(column) : undefined}
      style={{
        flex: 1,
        minWidth: 0,
        gap: 8,
        // Always bordered (transparent at rest) so highlighting a drop target doesn't shift the layout.
        padding: compact ? 0 : 6,
        borderRadius: 12,
        borderWidth: compact ? 0 : 1,
        borderColor: dropping ? theme.colors.accent : "transparent",
        backgroundColor: dropping ? theme.colors.surface1 : "transparent",
      }}
    >
      {column && title ? <ColumnHeading theme={theme} column={column} title={title} count={cards.length} /> : null}
      <ScrollView
        style={{ flex: 1 }}
        scrollEnabled={!drag.active}
        contentContainerStyle={{ gap: 8, paddingHorizontal: compact ? 16 : 0, paddingBottom: 16 }}
      >
        {cards.length === 0 ? (
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13, paddingVertical: 8 }}>No cards</Text>
        ) : (
          cards.map((card) => (
            <Draggable key={card.key} drag={drag} card={card}>
              <CardTile
                theme={theme}
                card={card}
                showRepo={showRepo}
                onPress={() => !drag.justDropped() && onOpen(card.key)}
                onStartAgent={() => onStartAgent(card.key)}
                onLongPress={drag.arm ? () => drag.arm!(card.key) : undefined}
                onPressOut={drag.disarm}
              />
            </Draggable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function CardTile({
  theme,
  card,
  showRepo,
  lifted,
  onPress,
  onLongPress,
  onPressOut,
  onStartAgent,
}: {
  theme: Theme;
  card: BoardCard;
  showRepo: boolean;
  // The copy that follows the pointer while dragging.
  lifted?: boolean;
  onPress?(): void;
  onLongPress?(): void;
  onPressOut?(): void;
  onStartAgent?(): void;
}) {
  const ref = cardRef(card, showRepo);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ref}: ${card.title}`}
      accessibilityHint="Opens the card. Drag it to another column to move it."
      onPress={onPress}
      onLongPress={onLongPress}
      onPressOut={onPressOut}
      delayLongPress={250}
      style={({ pressed }) => ({
        gap: 6,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: lifted ? theme.colors.accent : theme.colors.border,
        backgroundColor: pressed || lifted ? theme.colors.surface2 : theme.colors.surface1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ flex: 1, color: theme.colors.foregroundMuted, fontSize: 12 }} numberOfLines={1} selectable={false}>
          {ref}
        </Text>
        {onStartAgent && card.column !== "done" ? (
          <IconButton theme={theme} icon="Play" accessibilityLabel={`Start an agent on ${ref}`} onPress={onStartAgent} />
        ) : null}
      </View>
      <Text style={{ color: theme.colors.foreground, fontSize: 14, lineHeight: 20 }} numberOfLines={3} selectable={false}>
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
  dropping,
  dropRef,
  onPress,
}: {
  theme: Theme;
  column: ColumnId;
  title: string;
  count: number;
  selected: boolean;
  dropping: boolean;
  dropRef(view: View | null): void;
  onPress(): void;
}) {
  return (
    <Pressable
      ref={dropRef}
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
        borderWidth: 1,
        borderColor: dropping ? theme.colors.accent : "transparent",
        backgroundColor: selected || dropping ? theme.colors.surface2 : "transparent",
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
  title,
  subtitle,
  selected,
  onPress,
}: {
  theme: Theme;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
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
        <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>{title}</Text>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {selected ? <Icon name="Check" size={16} color={theme.colors.accent} /> : null}
    </Pressable>
  );
}
