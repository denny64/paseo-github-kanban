import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
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
