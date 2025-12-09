import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, IndustrialDesign } from "@/constants/theme";

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  small?: boolean;
}

export function FilterChip({
  label,
  selected,
  onPress,
  color,
  small = false,
}: FilterChipProps) {
  const { theme } = useTheme();
  const activeColor = color || theme.accent;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        small && styles.chipSmall,
        selected && { backgroundColor: activeColor, borderColor: activeColor },
        !selected && { 
          backgroundColor: theme.backgroundDefault, 
          borderColor: theme.border,
        },
        pressed && styles.chipPressed,
      ]}
    >
      <ThemedText
        type="small"
        style={[
          styles.label,
          small && styles.labelSmall,
          { color: selected ? theme.textOnAccent : theme.text },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    minHeight: IndustrialDesign.minTouchTarget,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  chipSmall: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 40,
  },
  chipPressed: {
    opacity: 0.8,
  },
  label: {
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  labelSmall: {
    fontSize: 12,
  },
});
