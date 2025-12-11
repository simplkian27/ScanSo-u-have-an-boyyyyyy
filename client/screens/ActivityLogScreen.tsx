import React, { useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Pressable, Alert, Platform, Linking } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { FilterChip } from "@/components/FilterChip";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { ActivityLog, User, ACTIVITY_LOG_TYPE_LABELS } from "@shared/schema";
import { getApiUrl } from "@/lib/query-client";

type UserWithoutPassword = Omit<User, "password">;
type TypeFilter = "all" | "TASK_ACCEPTED" | "TASK_COMPLETED" | "TASK_CANCELLED";

export default function ActivityLogScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [isExporting, setIsExporting] = useState(false);

  const typeConfig: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
    TASK_CREATED: { icon: "plus-circle", color: theme.statusOpen, label: ACTIVITY_LOG_TYPE_LABELS.TASK_CREATED || "Auftrag erstellt" },
    TASK_ASSIGNED: { icon: "user-check", color: theme.statusOpen, label: ACTIVITY_LOG_TYPE_LABELS.TASK_ASSIGNED || "Auftrag zugewiesen" },
    TASK_ACCEPTED: { icon: "check-circle", color: theme.statusInProgress, label: ACTIVITY_LOG_TYPE_LABELS.TASK_ACCEPTED || "Auftrag angenommen" },
    TASK_PICKED_UP: { icon: "log-in", color: theme.statusInProgress, label: ACTIVITY_LOG_TYPE_LABELS.TASK_PICKED_UP || "Container abgeholt" },
    TASK_IN_TRANSIT: { icon: "truck", color: theme.statusInProgress, label: ACTIVITY_LOG_TYPE_LABELS.TASK_IN_TRANSIT || "Transport gestartet" },
    TASK_DELIVERED: { icon: "log-out", color: theme.statusCompleted, label: ACTIVITY_LOG_TYPE_LABELS.TASK_DELIVERED || "Container geliefert" },
    TASK_COMPLETED: { icon: "check-square", color: theme.statusCompleted, label: ACTIVITY_LOG_TYPE_LABELS.TASK_COMPLETED || "Auftrag abgeschlossen" },
    TASK_CANCELLED: { icon: "x-circle", color: theme.statusCancelled, label: ACTIVITY_LOG_TYPE_LABELS.TASK_CANCELLED || "Auftrag storniert" },
    CONTAINER_SCANNED_AT_CUSTOMER: { icon: "maximize", color: theme.primary, label: ACTIVITY_LOG_TYPE_LABELS.CONTAINER_SCANNED_AT_CUSTOMER || "Container beim Kunden gescannt" },
    CONTAINER_SCANNED_AT_WAREHOUSE: { icon: "maximize", color: theme.primary, label: ACTIVITY_LOG_TYPE_LABELS.CONTAINER_SCANNED_AT_WAREHOUSE || "Container im Lager gescannt" },
    CONTAINER_STATUS_CHANGED: { icon: "refresh-cw", color: theme.primary, label: ACTIVITY_LOG_TYPE_LABELS.CONTAINER_STATUS_CHANGED || "Container-Status geändert" },
    WEIGHT_RECORDED: { icon: "database", color: theme.primary, label: ACTIVITY_LOG_TYPE_LABELS.WEIGHT_RECORDED || "Gewicht erfasst" },
    MANUAL_EDIT: { icon: "edit", color: theme.primary, label: ACTIVITY_LOG_TYPE_LABELS.MANUAL_EDIT || "Manuelle Bearbeitung" },
    SYSTEM_EVENT: { icon: "settings", color: theme.textSecondary, label: ACTIVITY_LOG_TYPE_LABELS.SYSTEM_EVENT || "Systemereignis" },
  };

  const { data: logs = [], isLoading, refetch, isRefetching } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
  });

  const { data: users = [] } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return "System";
    const user = users.find((u) => u.id === userId);
    return user?.name || "Unbekannter Benutzer";
  };

  const handleExportCSV = async () => {
    if (Platform.OS !== "web") {
      Alert.alert("Export", "CSV-Export ist nur in der Webversion verfügbar.");
      return;
    }

    if (logs.length === 0) {
      Alert.alert("Keine Daten", "Es gibt keine Aktivitätsprotokolle zum Exportieren.");
      return;
    }

    setIsExporting(true);
    try {
      const filterParam = typeFilter !== "all" ? `?type=${typeFilter}` : "";
      const exportUrl = `${getApiUrl()}/api/activity-logs/export/csv${filterParam}`;
      
      await Linking.openURL(exportUrl);
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Export fehlgeschlagen", "Aktivitätsprotokolle konnten nicht exportiert werden. Bitte erneut versuchen.");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (typeFilter === "all") return true;
    return log.type === typeFilter;
  });

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Gerade eben";
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tagen`;

    return d.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderLog = ({ item }: { item: ActivityLog }) => {
    const config = typeConfig[item.type] || { icon: "activity", color: theme.textSecondary, label: item.type };

    return (
      <Card style={styles.logCard}>
        <View style={styles.logHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${config.color}20` }]}>
            <Feather name={config.icon} size={20} color={config.color} />
          </View>
          <View style={styles.logContent}>
            <View style={styles.logTitleRow}>
              <ThemedText type="body" style={styles.logTitle}>
                {config.label}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {formatDate(item.timestamp || item.createdAt)}
              </ThemedText>
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
              {getUserName(item.userId)}
            </ThemedText>
            {item.message ? (
              <ThemedText type="small" style={{ marginTop: Spacing.xs }}>
                {item.message}
              </ThemedText>
            ) : null}
            {item.containerId ? (
              <View style={styles.logMeta}>
                <Feather name="package" size={12} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {item.containerId}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="activity" size={48} color={theme.textSecondary} />
      <ThemedText type="h4">
        Noch keine Aktivität
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary }}>
        Aktivitätsprotokolle werden hier angezeigt
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.filterContainer, { marginTop: headerHeight, backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.filterRow}>
          <FilterChip
            label="Alle"
            selected={typeFilter === "all"}
            onPress={() => setTypeFilter("all")}
            small
          />
          <FilterChip
            label="Angenommen"
            selected={typeFilter === "TASK_ACCEPTED"}
            onPress={() => setTypeFilter("TASK_ACCEPTED")}
            color={theme.statusInProgress}
            small
          />
          <FilterChip
            label="Abgeschlossen"
            selected={typeFilter === "TASK_COMPLETED"}
            onPress={() => setTypeFilter("TASK_COMPLETED")}
            color={theme.statusCompleted}
            small
          />
          <FilterChip
            label="Storniert"
            selected={typeFilter === "TASK_CANCELLED"}
            onPress={() => setTypeFilter("TASK_CANCELLED")}
            color={theme.statusCancelled}
            small
          />
        </View>
        <Pressable
          style={[styles.exportButton, { backgroundColor: `${theme.accent}15` }]}
          onPress={handleExportCSV}
          disabled={isExporting || logs.length === 0}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Feather name="download" size={16} color={theme.accent} />
          )}
          <ThemedText type="small" style={{ color: theme.accent, fontWeight: "600" }}>
            CSV exportieren
          </ThemedText>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item) => item.id}
          renderItem={renderLog}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl },
          ]}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  logCard: {
    padding: Spacing.md,
  },
  logHeader: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  logContent: {
    flex: 1,
  },
  logTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logTitle: {
    fontWeight: "600",
  },
  logMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
});
