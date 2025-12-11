import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, IndustrialDesign } from "@/constants/theme";
import { TASK_STATUS_LABELS } from "@shared/schema";

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: "small" | "medium" | "large";
}

export function StatusBadge({ status, label: customLabel, size = "medium" }: StatusBadgeProps) {
  const { theme } = useTheme();
  
  const getStatusConfig = () => {
    switch (status) {
      case "PLANNED":
        return {
          label: TASK_STATUS_LABELS.PLANNED || "Geplant",
          color: "#FFFFFF",
          backgroundColor: theme.statusOpen,
        };
      case "ASSIGNED":
        return {
          label: TASK_STATUS_LABELS.ASSIGNED || "Zugewiesen",
          color: "#FFFFFF",
          backgroundColor: theme.statusOpen,
        };
      case "ACCEPTED":
        return {
          label: TASK_STATUS_LABELS.ACCEPTED || "Angenommen",
          color: "#1E293B",
          backgroundColor: theme.statusInProgress,
        };
      case "PICKED_UP":
        return {
          label: TASK_STATUS_LABELS.PICKED_UP || "Abgeholt",
          color: "#1E293B",
          backgroundColor: theme.statusInProgress,
        };
      case "IN_TRANSIT":
        return {
          label: TASK_STATUS_LABELS.IN_TRANSIT || "Unterwegs",
          color: "#1E293B",
          backgroundColor: theme.statusInProgress,
        };
      case "DELIVERED":
        return {
          label: TASK_STATUS_LABELS.DELIVERED || "Geliefert",
          color: "#FFFFFF",
          backgroundColor: theme.statusCompleted,
        };
      case "COMPLETED":
        return {
          label: TASK_STATUS_LABELS.COMPLETED || "Abgeschlossen",
          color: "#FFFFFF",
          backgroundColor: theme.statusCompleted,
        };
      case "CANCELLED":
        return {
          label: TASK_STATUS_LABELS.CANCELLED || "Storniert",
          color: "#FFFFFF",
          backgroundColor: theme.statusCancelled,
        };
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
      case "critical":
        return {
          label: "Kritisch",
          color: "#FFFFFF",
          backgroundColor: theme.fillHigh,
        };
      case "warning":
        return {
          label: "Warnung",
          color: "#1E293B",
          backgroundColor: theme.fillMedium,
        };
      case "success":
        return {
          label: "OK",
          color: "#FFFFFF",
          backgroundColor: theme.fillLow,
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
  const displayLabel = customLabel || config.label;
  
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
        {displayLabel}
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
