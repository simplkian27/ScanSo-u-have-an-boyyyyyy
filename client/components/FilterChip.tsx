import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

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
  const activeColor = color || Colors.light.accent;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        small && styles.chipSmall,
        selected && { backgroundColor: activeColor },
        !selected && styles.chipOutline,
        pressed && styles.chipPressed,
      ]}
    >
      <ThemedText
        type="small"
        style={[
          styles.label,
          small && styles.labelSmall,
          { color: selected ? "#FFFFFF" : Colors.light.text },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.accent,
  },
  chipSmall: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chipOutline: {
    backgroundColor: Colors.light.backgroundDefault,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  chipPressed: {
    opacity: 0.7,
  },
  label: {
    fontWeight: "600",
  },
  labelSmall: {
    fontSize: 12,
  },
});
