import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface StatusBadgeProps {
  status: string;
  size?: "small" | "medium";
}

const statusConfig: Record<string, { label: string; color: string; backgroundColor: string }> = {
  open: {
    label: "Open",
    color: "#FFFFFF",
    backgroundColor: Colors.light.statusOpen,
  },
  in_progress: {
    label: "In Progress",
    color: "#FFFFFF",
    backgroundColor: Colors.light.statusInProgress,
  },
  completed: {
    label: "Completed",
    color: "#FFFFFF",
    backgroundColor: Colors.light.statusCompleted,
  },
  cancelled: {
    label: "Cancelled",
    color: "#FFFFFF",
    backgroundColor: Colors.light.statusCancelled,
  },
};

export function StatusBadge({ status, size = "medium" }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.open;
  const isSmall = size === "small";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.backgroundColor },
        isSmall && styles.badgeSmall,
      ]}
    >
      <ThemedText
        type="small"
        style={[
          styles.label,
          { color: config.color },
          isSmall && styles.labelSmall,
        ]}
      >
        {config.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  badgeSmall: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  labelSmall: {
    fontSize: 10,
  },
});
