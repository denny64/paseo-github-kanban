import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import type { ReactNode } from "react";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Pressable, Text, View } from "react-native";
import type { ColumnId } from "../shared/board";

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
