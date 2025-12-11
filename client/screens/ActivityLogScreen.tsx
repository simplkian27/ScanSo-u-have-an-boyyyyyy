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
import { ActivityLog, User } from "@shared/schema";
import { getApiUrl } from "@/lib/query-client";

type UserWithoutPassword = Omit<User, "password">;
type ActionFilter = "all" | "pickup" | "delivery" | "cancelled";

export default function ActivityLogScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [isExporting, setIsExporting] = useState(false);

  const actionConfig: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
    pickup: { icon: "log-in", color: theme.statusInProgress, label: "Abholung" },
    delivery: { icon: "log-out", color: theme.statusCompleted, label: "Lieferung" },
    cancelled: { icon: "x-circle", color: theme.statusCancelled, label: "Storniert" },
    manual_edit: { icon: "edit", color: theme.primary, label: "Bearbeitet" },
    emptied: { icon: "refresh-ccw", color: theme.fillLow, label: "Geleert" },
  };

  const { data: logs = [], isLoading, refetch, isRefetching } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
  });

  const { data: users = [] } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
  });

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.name || "Unknown User";
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
      const filterParam = actionFilter !== "all" ? `?action=${actionFilter}` : "";
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
    if (actionFilter === "all") return true;
    return log.action === actionFilter;
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
    const config = actionConfig[item.action] || { icon: "activity", color: theme.textSecondary, label: item.action };

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
                {formatDate(item.createdAt)}
              </ThemedText>
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
              {getUserName(item.userId)}
            </ThemedText>
            {item.details ? (
              <ThemedText type="small" style={{ marginTop: Spacing.xs }}>
                {item.details}
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
            selected={actionFilter === "all"}
            onPress={() => setActionFilter("all")}
            small
          />
          <FilterChip
            label="Abholungen"
            selected={actionFilter === "pickup"}
            onPress={() => setActionFilter("pickup")}
            color={theme.statusInProgress}
            small
          />
          <FilterChip
            label="Lieferungen"
            selected={actionFilter === "delivery"}
            onPress={() => setActionFilter("delivery")}
            color={theme.statusCompleted}
            small
          />
          <FilterChip
            label="Storniert"
            selected={actionFilter === "cancelled"}
            onPress={() => setActionFilter("cancelled")}
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
