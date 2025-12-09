import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, IndustrialDesign } from "@/constants/theme";

interface StatusBadgeProps {
  status: string;
  size?: "small" | "medium" | "large";
}

export function StatusBadge({ status, size = "medium" }: StatusBadgeProps) {
  const { theme } = useTheme();
  
  const getStatusConfig = () => {
    switch (status) {
      case "open":
        return {
          label: "Offen",
          color: "#FFFFFF",
          backgroundColor: theme.statusOpen,
        };
      case "in_progress":
        return {
          label: "In Bearbeitung",
          color: "#1E293B",
          backgroundColor: theme.statusInProgress,
        };
      case "completed":
        return {
          label: "Erledigt",
          color: "#FFFFFF",
          backgroundColor: theme.statusCompleted,
        };
      case "cancelled":
        return {
          label: "Storniert",
          color: "#FFFFFF",
          backgroundColor: theme.statusCancelled,
        };
      case "active":
        return {
          label: "Aktiv",
          color: "#FFFFFF",
          backgroundColor: theme.success,
        };
      case "inactive":
        return {
          label: "Inaktiv",
          color: "#FFFFFF",
          backgroundColor: theme.statusIdle,
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
  
  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return {
          badge: styles.badgeSmall,
          label: styles.labelSmall,
        };
      case "large":
        return {
          badge: styles.badgeLarge,
          label: styles.labelLarge,
        };
      default:
        return {
          badge: null,
          label: null,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.backgroundColor },
        sizeStyles.badge,
      ]}
    >
      <ThemedText
        type="caption"
        style={[
          styles.label,
          { color: config.color },
          sizeStyles.label,
        ]}
      >
        {config.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: IndustrialDesign.statusBadgePaddingH,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    minHeight: IndustrialDesign.statusBadgeHeight,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  badgeSmall: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    minHeight: 22,
  },
  badgeLarge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 34,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  labelSmall: {
    fontSize: 10,
    letterSpacing: 0.4,
  },
  labelLarge: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
