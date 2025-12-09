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
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { ActivityLog, User } from "@shared/schema";
import { getApiUrl } from "@/lib/query-client";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

type UserWithoutPassword = Omit<User, "password">;
type ActionFilter = "all" | "pickup" | "delivery" | "cancelled";

const actionConfig: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
  pickup: { icon: "log-in", color: Colors.light.statusInProgress, label: "Pickup" },
  delivery: { icon: "log-out", color: Colors.light.statusCompleted, label: "Delivery" },
  cancelled: { icon: "x-circle", color: Colors.light.statusCancelled, label: "Cancelled" },
  manual_edit: { icon: "edit", color: Colors.light.primary, label: "Edited" },
  emptied: { icon: "refresh-ccw", color: Colors.light.fillLow, label: "Emptied" },
};

export default function ActivityLogScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [isExporting, setIsExporting] = useState(false);

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
    if (logs.length === 0) {
      Alert.alert("No Data", "There are no activity logs to export.");
      return;
    }

    setIsExporting(true);
    try {
      const filterParam = actionFilter !== "all" ? `?action=${actionFilter}` : "";
      const exportUrl = `${getApiUrl()}/api/activity-logs/export/csv${filterParam}`;
      
      if (Platform.OS === "web") {
        await Linking.openURL(exportUrl);
        setIsExporting(false);
        return;
      }

      const fileName = `activity-log-${new Date().toISOString().split("T")[0]}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      const downloadResult = await FileSystem.downloadAsync(exportUrl, fileUri);
      
      if (downloadResult.status === 200) {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: "text/csv",
            dialogTitle: "Export Activity Log",
            UTI: "public.comma-separated-values-text",
          });
        } else {
          Alert.alert("Export Complete", `File saved to ${fileName}`);
        }
      } else {
        throw new Error("Download failed");
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Export Failed", "Failed to export activity logs. Please try again.");
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

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderLog = ({ item }: { item: ActivityLog }) => {
    const config = actionConfig[item.action] || { icon: "activity", color: Colors.light.textSecondary, label: item.action };

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
              <ThemedText type="small" style={styles.logTime}>
                {formatDate(item.createdAt)}
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.logUser}>
              {getUserName(item.userId)}
            </ThemedText>
            {item.details ? (
              <ThemedText type="small" style={styles.logDetails}>
                {item.details}
              </ThemedText>
            ) : null}
            {item.containerId ? (
              <View style={styles.logMeta}>
                <Feather name="package" size={12} color={Colors.light.textSecondary} />
                <ThemedText type="small" style={styles.logMetaText}>
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
      <Feather name="activity" size={48} color={Colors.light.textSecondary} />
      <ThemedText type="h4" style={styles.emptyTitle}>
        No activity yet
      </ThemedText>
      <ThemedText type="body" style={styles.emptySubtitle}>
        Activity logs will appear here
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.filterContainer, { marginTop: headerHeight }]}>
        <View style={styles.filterRow}>
          <FilterChip
            label="All"
            selected={actionFilter === "all"}
            onPress={() => setActionFilter("all")}
            small
          />
          <FilterChip
            label="Pickups"
            selected={actionFilter === "pickup"}
            onPress={() => setActionFilter("pickup")}
            color={Colors.light.statusInProgress}
            small
          />
          <FilterChip
            label="Deliveries"
            selected={actionFilter === "delivery"}
            onPress={() => setActionFilter("delivery")}
            color={Colors.light.statusCompleted}
            small
          />
          <FilterChip
            label="Cancelled"
            selected={actionFilter === "cancelled"}
            onPress={() => setActionFilter("cancelled")}
            color={Colors.light.statusCancelled}
            small
          />
        </View>
        <Pressable
          style={styles.exportButton}
          onPress={handleExportCSV}
          disabled={isExporting || logs.length === 0}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={Colors.light.accent} />
          ) : (
            <Feather name="download" size={16} color={Colors.light.accent} />
          )}
          <ThemedText type="small" style={styles.exportButtonText}>
            Export CSV
          </ThemedText>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
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
              tintColor={Colors.light.accent}
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
    backgroundColor: Colors.light.backgroundRoot,
  },
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundDefault,
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
    backgroundColor: `${Colors.light.accent}15`,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  exportButtonText: {
    color: Colors.light.accent,
    fontWeight: "600",
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
    backgroundColor: Colors.light.backgroundDefault,
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
  logTime: {
    color: Colors.light.textSecondary,
  },
  logUser: {
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  logDetails: {
    color: Colors.light.text,
    marginTop: Spacing.xs,
  },
  logMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  logMetaText: {
    color: Colors.light.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    color: Colors.light.text,
  },
  emptySubtitle: {
    color: Colors.light.textSecondary,
  },
});
