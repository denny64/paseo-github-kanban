import { ScrollView } from "@getpaseo/plugin/client/react-native";
import { Pressable, Text, View } from "react-native";
import { type Card, COLUMNS, type ColumnId } from "../shared/board";
import { timeAgo } from "../shared/time";
import { ColumnHeading, LabelPill, type Theme } from "./controls";

// Every card on one scrolling page, grouped by column in board order.
export function ListView({
  theme,
  compact,
  byColumn,
  onOpen,
}: {
  theme: Theme;
  compact: boolean;
  byColumn: Map<ColumnId, Card[]>;
  onOpen(number: number): void;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ gap: 20, paddingHorizontal: compact ? 16 : 24, paddingBottom: 24 }}
    >
      {COLUMNS.map((column) => {
        const cards = byColumn.get(column.id)!;
        return (
          <View key={column.id} style={{ gap: 6 }}>
            <ColumnHeading theme={theme} column={column.id} title={column.title} count={cards.length} />
            {cards.length === 0 ? (
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>No cards</Text>
            ) : (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 10,
                  backgroundColor: theme.colors.surface1,
                  overflow: "hidden",
                }}
              >
                {cards.map((card, index) => (
                  <ListRow
                    key={card.number}
                    theme={theme}
                    card={card}
                    compact={compact}
                    first={index === 0}
                    onPress={() => onOpen(card.number)}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function ListRow({
  theme,
  card,
  compact,
  first,
  onPress,
}: {
  theme: Theme;
  card: Card;
  compact: boolean;
  first: boolean;
  onPress(): void;
}) {
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 };
  const age = timeAgo(card.updatedAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Issue ${card.number}: ${card.title}, updated ${age === "now" ? "just now" : `${age} ago`}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surface2 : "transparent",
      })}
    >
      <Text style={[muted, { minWidth: 40, fontVariant: ["tabular-nums"] }]}>#{card.number}</Text>
      <Text
        style={{ flex: 1, color: theme.colors.foreground, fontSize: 14, lineHeight: 20 }}
        numberOfLines={compact ? 2 : 1}
      >
        {card.title}
      </Text>
      {/* Labels and assignees need the width; compact rows keep number, title and age. */}
      {!compact
        ? card.labels
            .slice(0, 3)
            .map((label) => <LabelPill key={label.name} theme={theme} name={label.name} color={label.color} />)
        : null}
      {!compact && card.labels.length > 3 ? <Text style={muted}>+{card.labels.length - 3}</Text> : null}
      {!compact && card.assignees.length > 0 ? (
        <Text style={muted} numberOfLines={1}>
          @{card.assignees[0]}
          {card.assignees.length > 1 ? ` +${card.assignees.length - 1}` : ""}
        </Text>
      ) : null}
      <Text style={[muted, { minWidth: 32, textAlign: "right", fontVariant: ["tabular-nums"] }]}>{age}</Text>
    </Pressable>
  );
}
