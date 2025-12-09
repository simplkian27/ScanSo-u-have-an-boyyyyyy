import React from "react";
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface DriverStats {
  id: string;
  name: string;
  email: string;
  totalAssigned: number;
  totalCompleted: number;
  completedToday: number;
  completedThisWeek: number;
  inProgress: number;
  completionRate: number;
  avgDeliveryTimeMinutes: number;
}

interface OverallStats {
  totalDrivers: number;
  activeDrivers: number;
  totalCompletedToday: number;
  totalCompletedThisWeek: number;
  avgCompletionRate: number;
}

interface PerformanceData {
  drivers: DriverStats[];
  overall: OverallStats;
}

export default function DriverPerformanceScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const { data, isLoading, refetch, isRefetching } = useQuery<PerformanceData>({
    queryKey: ["/api/analytics/driver-performance"],
  });

  const getPerformanceColor = (rate: number) => {
    if (rate >= 80) return Colors.light.statusCompleted;
    if (rate >= 50) return Colors.light.statusInProgress;
    return Colors.light.statusCancelled;
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.light.accent}
          />
        }
      >
        <Card style={styles.overviewCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Team Overview
          </ThemedText>
          <View style={styles.overviewGrid}>
            <View style={styles.overviewItem}>
              <View style={[styles.overviewIcon, { backgroundColor: `${Colors.light.primary}20` }]}>
                <Feather name="users" size={24} color={Colors.light.primary} />
              </View>
              <ThemedText type="h3" style={styles.overviewValue}>
                {data?.overall.totalDrivers || 0}
              </ThemedText>
              <ThemedText type="small" style={styles.overviewLabel}>
                Total Drivers
              </ThemedText>
            </View>
            <View style={styles.overviewItem}>
              <View style={[styles.overviewIcon, { backgroundColor: `${Colors.light.statusInProgress}20` }]}>
                <Feather name="activity" size={24} color={Colors.light.statusInProgress} />
              </View>
              <ThemedText type="h3" style={styles.overviewValue}>
                {data?.overall.activeDrivers || 0}
              </ThemedText>
              <ThemedText type="small" style={styles.overviewLabel}>
                Active Today
              </ThemedText>
            </View>
            <View style={styles.overviewItem}>
              <View style={[styles.overviewIcon, { backgroundColor: `${Colors.light.statusCompleted}20` }]}>
                <Feather name="check-circle" size={24} color={Colors.light.statusCompleted} />
              </View>
              <ThemedText type="h3" style={styles.overviewValue}>
                {data?.overall.totalCompletedThisWeek || 0}
              </ThemedText>
              <ThemedText type="small" style={styles.overviewLabel}>
                This Week
              </ThemedText>
            </View>
            <View style={styles.overviewItem}>
              <View style={[styles.overviewIcon, { backgroundColor: `${Colors.light.accent}20` }]}>
                <Feather name="trending-up" size={24} color={Colors.light.accent} />
              </View>
              <ThemedText type="h3" style={styles.overviewValue}>
                {data?.overall.avgCompletionRate || 0}%
              </ThemedText>
              <ThemedText type="small" style={styles.overviewLabel}>
                Avg Completion
              </ThemedText>
            </View>
          </View>
        </Card>

        <ThemedText type="h4" style={styles.sectionTitle}>
          Driver Performance
        </ThemedText>

        {data?.drivers.map((driver) => (
          <Card key={driver.id} style={styles.driverCard}>
            <View style={styles.driverHeader}>
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatar}>
                  <Feather name="user" size={20} color={Colors.light.textOnAccent} />
                </View>
                <View>
                  <ThemedText type="body" style={styles.driverName}>{driver.name}</ThemedText>
                  <ThemedText type="small" style={styles.driverEmail}>{driver.email}</ThemedText>
                </View>
              </View>
              <View style={[styles.statusBadge, driver.inProgress > 0 ? styles.activeBadge : styles.idleBadge]}>
                <ThemedText type="small" style={driver.inProgress > 0 ? styles.activeText : styles.idleText}>
                  {driver.inProgress > 0 ? "Active" : "Idle"}
                </ThemedText>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText type="h4" style={styles.statValue}>{driver.completedToday}</ThemedText>
                <ThemedText type="small" style={styles.statLabel}>Today</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="h4" style={styles.statValue}>{driver.completedThisWeek}</ThemedText>
                <ThemedText type="small" style={styles.statLabel}>This Week</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="h4" style={styles.statValue}>{driver.totalCompleted}</ThemedText>
                <ThemedText type="small" style={styles.statLabel}>Total</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="h4" style={styles.statValue}>
                  {driver.avgDeliveryTimeMinutes > 0 ? `${driver.avgDeliveryTimeMinutes}m` : "-"}
                </ThemedText>
                <ThemedText type="small" style={styles.statLabel}>Avg Time</ThemedText>
              </View>
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <ThemedText type="small" style={styles.progressLabel}>Completion Rate</ThemedText>
                <ThemedText type="body" style={[styles.progressValue, { color: getPerformanceColor(driver.completionRate) }]}>
                  {driver.completionRate}%
                </ThemedText>
              </View>
              <ProgressBar
                progress={driver.completionRate / 100}
                color={getPerformanceColor(driver.completionRate)}
                style={styles.progressBar}
              />
            </View>

            <View style={styles.taskBreakdown}>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownDot, { backgroundColor: Colors.light.statusCompleted }]} />
                <ThemedText type="small" style={styles.breakdownText}>
                  {driver.totalCompleted} completed
                </ThemedText>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownDot, { backgroundColor: Colors.light.statusInProgress }]} />
                <ThemedText type="small" style={styles.breakdownText}>
                  {driver.inProgress} in progress
                </ThemedText>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownDot, { backgroundColor: Colors.light.statusOpen }]} />
                <ThemedText type="small" style={styles.breakdownText}>
                  {driver.totalAssigned - driver.totalCompleted - driver.inProgress} pending
                </ThemedText>
              </View>
            </View>
          </Card>
        ))}

        {(!data?.drivers || data.drivers.length === 0) ? (
          <Card style={styles.emptyCard}>
            <Feather name="users" size={48} color={Colors.light.textSecondary} />
            <ThemedText type="body" style={styles.emptyText}>
              No drivers found
            </ThemedText>
          </Card>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundRoot,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  overviewCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  overviewItem: {
    width: "46%",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  overviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  overviewValue: {
    color: Colors.light.text,
  },
  overviewLabel: {
    color: Colors.light.textSecondary,
  },
  driverCard: {
    backgroundColor: Colors.light.backgroundDefault,
    gap: Spacing.md,
  },
  driverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  driverName: {
    fontWeight: "600",
    color: Colors.light.text,
  },
  driverEmail: {
    color: Colors.light.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  activeBadge: {
    backgroundColor: `${Colors.light.statusInProgress}20`,
  },
  idleBadge: {
    backgroundColor: `${Colors.light.textSecondary}20`,
  },
  activeText: {
    color: Colors.light.statusInProgress,
    fontWeight: "600",
  },
  idleText: {
    color: Colors.light.textSecondary,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
  },
  statItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  statValue: {
    color: Colors.light.text,
  },
  statLabel: {
    color: Colors.light.textSecondary,
    fontSize: 11,
  },
  progressSection: {
    gap: Spacing.sm,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    color: Colors.light.textSecondary,
  },
  progressValue: {
    fontWeight: "700",
  },
  progressBar: {
    height: 8,
  },
  taskBreakdown: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  breakdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownText: {
    color: Colors.light.textSecondary,
    fontSize: 11,
  },
  emptyCard: {
    backgroundColor: Colors.light.backgroundDefault,
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    color: Colors.light.textSecondary,
  },
});
