import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import type { ReactNode } from "react";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Pressable, Text, View } from "react-native";
import type { ColumnId, Schedule } from "../shared/board";
import { runAtLabel } from "../shared/time";

export type Theme = PluginSurfaceProps["theme"];

export function Button({
  theme,
  label,
  icon,
  primary,
  disabled,
  accessibilityLabel,
  onPress,
}: {
  theme: Theme;
  label?: string;
  icon?: string;
  primary?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  onPress(): void;
}) {
  const color = primary ? theme.colors.accentForeground : theme.colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: label ? 12 : 8,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: primary ? theme.colors.accent : theme.colors.surface2,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      {label ? <Text style={{ color, fontSize: 13, fontWeight: "500" }}>{label}</Text> : null}
    </Pressable>
  );
}

export function inputStyle(theme: Theme, multiline = false) {
  return {
    color: theme.colors.foreground,
    backgroundColor: theme.colors.surface1,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    ...(multiline ? { minHeight: 120, textAlignVertical: "top" as const } : {}),
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function columnColor(theme: Theme, column: ColumnId): string {
  if (column === "in-progress") return theme.colors.statusWarning;
  if (column === "in-review") return theme.colors.accent;
  if (column === "done") return theme.colors.statusSuccess;
  return theme.colors.foregroundMuted;
}

export function LabelPill({ theme, name, color }: { theme: Theme; name: string; color: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: theme.colors.surface2,
      }}
    >
      {/* The dot is GitHub's label colour; the text stays on theme colours. */}
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: `#${color}` }} />
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{name}</Text>
    </View>
  );
}

// Muted hues that read on light and dark themes; a repo always gets the same one.
const REPO_COLORS = ["#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#84cc16", "#f59e0b", "#f97316", "#ec4899"];

export function repoColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return REPO_COLORS[Math.abs(hash) % REPO_COLORS.length];
}

// A card's repo: squarer than a label pill so the two read apart.
export function RepoTag({ theme, name }: { theme: Theme; name: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexShrink: 1,
        gap: 5,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: repoColor(name) }} />
      <Text style={{ flexShrink: 1, color: theme.colors.foreground, fontSize: 11, fontWeight: "500" }} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

// A card's scheduled start, or why it failed. `long` spells it out for the card view.
export function ScheduleBadge({ theme, schedule, long }: { theme: Theme; schedule: Schedule; long?: boolean }) {
  const color = schedule.error ? theme.colors.statusDanger : theme.colors.foregroundMuted;
  const text = schedule.error
    ? long ? `Scheduled start failed: ${schedule.error}` : "Start failed"
    : long ? `Starts at ${runAtLabel(schedule.runAt)}` : runAtLabel(schedule.runAt);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
      <Icon name={schedule.error ? "TriangleAlert" : "Clock"} size={12} color={color} />
      <Text style={{ flexShrink: 1, color, fontSize: 12 }} numberOfLines={long ? 3 : 1}>
        {text}
      </Text>
    </View>
  );
}

export function ColumnHeading({
  theme,
  column,
  title,
  count,
  trailing,
}: {
  theme: Theme;
  column: ColumnId;
  title: string;
  count: number;
  trailing?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: columnColor(theme, column) }} />
      <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600" }}>{title}</Text>
      <Text style={{ flex: 1, color: theme.colors.foregroundMuted, fontSize: 13 }}>{count}</Text>
      {trailing}
    </View>
  );
}

// Compact icon action for card tiles and list rows.
export function IconButton({
  theme,
  icon,
  accessibilityLabel,
  onPress,
}: {
  theme: Theme;
  icon: string;
  accessibilityLabel: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 4,
        borderRadius: 6,
        backgroundColor: pressed ? theme.colors.surface2 : "transparent",
      })}
    >
      <Icon name={icon} size={14} color={theme.colors.foregroundMuted} />
    </Pressable>
  );
}

// Small text action for column headings ("Clear").
export function TextAction({ theme, label, accessibilityLabel, onPress }: { theme: Theme; label: string; accessibilityLabel: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: pressed ? theme.colors.surface2 : "transparent" })}
    >
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}
