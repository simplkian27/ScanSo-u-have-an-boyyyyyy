import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface StatusBadgeProps {
  status: string;
  size?: "small" | "medium";
}

export function StatusBadge({ status, size = "medium" }: StatusBadgeProps) {
  const { theme } = useTheme();
  
  const getStatusConfig = () => {
    switch (status) {
      case "open":
        return {
          label: "Offen",
          color: "#FFFFFF",
          backgroundColor: theme.statusOpen || theme.statusIdle,
        };
      case "in_progress":
        return {
          label: "In Bearbeitung",
          color: "#FFFFFF",
          backgroundColor: theme.statusInProgress,
        };
      case "completed":
        return {
          label: "Erledigt",
          color: "#FFFFFF",
          backgroundColor: theme.statusCompleted || theme.success,
        };
      case "cancelled":
        return {
          label: "Storniert",
          color: "#FFFFFF",
          backgroundColor: theme.statusCancelled || theme.error,
        };
      default:
        return {
          label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " "),
          color: "#FFFFFF",
          backgroundColor: theme.statusIdle,
        };
    }
  };

  const config = getStatusConfig();
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
    minHeight: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeSmall: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minHeight: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 10,
  },
});
