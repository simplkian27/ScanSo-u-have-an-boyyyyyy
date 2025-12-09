import React from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "AdminDashboard">;

interface DashboardStats {
  openTasks: number;
  inProgressTasks: number;
  completedToday: number;
  activeDrivers: number;
  criticalContainers: number;
  totalCapacity: number;
  availableCapacity: number;
}

export default function AdminDashboardScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();

  const { data: stats, isLoading, refetch, isRefetching } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const StatCard = ({
    icon,
    label,
    value,
    color,
    onPress,
  }: {
    icon: keyof typeof Feather.glyphMap;
    label: string;
    value: number | string;
    color: string;
    onPress?: () => void;
  }) => (
    <Pressable
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
    >
      <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
        <Feather name={icon} size={24} color={color} />
      </View>
      <ThemedText type="h2" style={styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText type="small" style={styles.statLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );

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
        <ThemedText type="h4" style={styles.sectionTitle}>
          Today's Overview
        </ThemedText>

        <View style={styles.statsGrid}>
          <StatCard
            icon="inbox"
            label="Open Tasks"
            value={stats?.openTasks || 0}
            color={Colors.light.statusOpen}
          />
          <StatCard
            icon="truck"
            label="In Progress"
            value={stats?.inProgressTasks || 0}
            color={Colors.light.statusInProgress}
          />
          <StatCard
            icon="check-circle"
            label="Completed Today"
            value={stats?.completedToday || 0}
            color={Colors.light.statusCompleted}
          />
          <StatCard
            icon="users"
            label="Active Drivers"
            value={stats?.activeDrivers || 0}
            color={Colors.light.primary}
          />
        </View>

        <ThemedText type="h4" style={styles.sectionTitle}>
          Container Status
        </ThemedText>

        <View style={styles.statsRow}>
          <Card style={[styles.alertCard, stats?.criticalContainers ? styles.alertCardWarning : null]}>
            <View style={styles.alertContent}>
              <Feather
                name="alert-triangle"
                size={24}
                color={stats?.criticalContainers ? Colors.light.fillHigh : Colors.light.fillLow}
              />
              <View>
                <ThemedText type="h3" style={styles.alertValue}>
                  {stats?.criticalContainers || 0}
                </ThemedText>
                <ThemedText type="small" style={styles.alertLabel}>
                  Critical Containers
                </ThemedText>
              </View>
            </View>
          </Card>

          <Card style={styles.capacityCard}>
            <View style={styles.alertContent}>
              <Feather name="database" size={24} color={Colors.light.primary} />
              <View>
                <ThemedText type="h3" style={styles.alertValue}>
                  {stats?.availableCapacity ? `${(stats.availableCapacity / 1000).toFixed(1)}t` : "0t"}
                </ThemedText>
                <ThemedText type="small" style={styles.alertLabel}>
                  Available Capacity
                </ThemedText>
              </View>
            </View>
          </Card>
        </View>

        <ThemedText type="h4" style={styles.sectionTitle}>
          Quick Actions
        </ThemedText>

        <View style={styles.actionsGrid}>
          <Button
            style={styles.actionButton}
            onPress={() => navigation.navigate("CreateTask")}
          >
            <View style={styles.actionContent}>
              <Feather name="plus-circle" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={styles.actionText}>
                Create Task
              </ThemedText>
            </View>
          </Button>

          <Button
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("ManageDrivers")}
          >
            <View style={styles.actionContent}>
              <Feather name="users" size={20} color={Colors.light.primary} />
              <ThemedText type="body" style={styles.secondaryText}>
                Manage Drivers
              </ThemedText>
            </View>
          </Button>

          <Button
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("ManageContainers")}
          >
            <View style={styles.actionContent}>
              <Feather name="package" size={20} color={Colors.light.primary} />
              <ThemedText type="body" style={styles.secondaryText}>
                Manage Containers
              </ThemedText>
            </View>
          </Button>

          <Button
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("ActivityLog")}
          >
            <View style={styles.actionContent}>
              <Feather name="activity" size={20} color={Colors.light.primary} />
              <ThemedText type="body" style={styles.secondaryText}>
                Activity Log
              </ThemedText>
            </View>
          </Button>
        </View>

        <Pressable
          style={styles.profileLink}
          onPress={() => navigation.navigate("Profile")}
        >
          <Feather name="user" size={20} color={Colors.light.textSecondary} />
          <ThemedText type="body" style={styles.profileLinkText}>
            View Profile
          </ThemedText>
          <Feather name="chevron-right" size={20} color={Colors.light.textSecondary} />
        </Pressable>
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
    gap: Spacing.lg,
  },
  sectionTitle: {
    marginTop: Spacing.sm,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  statCard: {
    width: "47%",
    backgroundColor: Colors.light.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderLeftWidth: 4,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  statValue: {
    marginBottom: Spacing.xs,
  },
  statLabel: {
    color: Colors.light.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  alertCard: {
    flex: 1,
    backgroundColor: Colors.light.backgroundDefault,
  },
  alertCardWarning: {
    backgroundColor: "#FFEBEE",
  },
  capacityCard: {
    flex: 1,
    backgroundColor: Colors.light.backgroundDefault,
  },
  alertContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  alertValue: {
    marginBottom: 2,
  },
  alertLabel: {
    color: Colors.light.textSecondary,
  },
  actionsGrid: {
    gap: Spacing.md,
  },
  actionButton: {
    backgroundColor: Colors.light.accent,
  },
  secondaryButton: {
    backgroundColor: Colors.light.backgroundDefault,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  actionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  secondaryText: {
    color: Colors.light.primary,
    fontWeight: "600",
  },
  profileLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  profileLinkText: {
    color: Colors.light.textSecondary,
    flex: 1,
  },
});
