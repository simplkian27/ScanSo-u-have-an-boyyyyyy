import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { FilterChip } from "@/components/FilterChip";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { TasksStackParamList } from "@/navigation/TasksStackNavigator";
import { Task, CustomerContainer } from "@shared/schema";
import { openMapsNavigation } from "@/lib/navigation";

type NavigationProp = NativeStackNavigationProp<TasksStackParamList, "Tasks">;

type TaskFilter = "all" | "mine" | "today";
type StatusFilter = "all" | "open" | "in_progress" | "completed" | "cancelled";

export default function TasksScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [taskFilter, setTaskFilter] = useState<TaskFilter>("mine");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: tasks = [], isLoading, refetch, isRefetching } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: containers = [] } = useQuery<CustomerContainer[]>({
    queryKey: ["/api/containers/customer"],
  });

  const getContainerById = (containerId: string) => {
    return containers.find((c) => c.id === containerId);
  };

  const handleQuickNavigation = async (containerId: string) => {
    const container = getContainerById(containerId);
    if (container?.latitude && container?.longitude) {
      await openMapsNavigation({
        latitude: container.latitude,
        longitude: container.longitude,
        label: `${container.customerName} - ${container.location}`,
      });
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (taskFilter === "mine" && task.assignedTo !== user?.id) return false;
    if (taskFilter === "today") {
      const today = new Date();
      const taskDate = task.scheduledTime ? new Date(task.scheduledTime) : null;
      if (!taskDate || taskDate.toDateString() !== today.toDateString()) return false;
    }
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return Colors.light.statusOpen;
      case "in_progress": return Colors.light.statusInProgress;
      case "completed": return Colors.light.statusCompleted;
      case "cancelled": return Colors.light.statusCancelled;
      default: return Colors.light.statusOpen;
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Not scheduled";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const renderTask = ({ item }: { item: Task }) => {
    const container = getContainerById(item.containerID);
    const hasLocation = container?.latitude && container?.longitude;

    return (
      <Card
        style={styles.taskCard}
        onPress={() => navigation.navigate("TaskDetail", { taskId: item.id })}
      >
        <View style={styles.taskHeader}>
          <View style={styles.taskIdContainer}>
            <Feather name="package" size={20} color={Colors.light.primary} />
            <ThemedText type="h4" style={styles.taskId}>
              {item.containerID}
            </ThemedText>
          </View>
          <StatusBadge status={item.status} />
        </View>
        
        <View style={styles.taskDetails}>
          <View style={styles.detailRow}>
            <Feather name="map-pin" size={16} color={Colors.light.textSecondary} />
            <ThemedText type="body" style={styles.detailText} numberOfLines={1}>
              {container?.location || "Loading..."}
            </ThemedText>
          </View>
          {container?.customerName ? (
            <View style={styles.detailRow}>
              <Feather name="home" size={16} color={Colors.light.textSecondary} />
              <ThemedText type="small" style={styles.detailText}>
                {container.customerName}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Feather name="clock" size={16} color={Colors.light.textSecondary} />
            <ThemedText type="small" style={styles.detailText}>
              {formatDate(item.scheduledTime)}
            </ThemedText>
          </View>
          {item.materialType ? (
            <View style={styles.detailRow}>
              <Feather name="tag" size={16} color={Colors.light.textSecondary} />
              <ThemedText type="small" style={styles.detailText}>
                {item.materialType}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.taskFooter}>
          {hasLocation && (item.status === "open" || item.status === "in_progress") ? (
            <Pressable 
              style={styles.navButton}
              onPress={(e) => {
                e.stopPropagation();
                handleQuickNavigation(item.containerID);
              }}
            >
              <Feather name="navigation" size={16} color={Colors.light.accent} />
              <ThemedText type="small" style={styles.navButtonText}>
                Navigate
              </ThemedText>
            </Pressable>
          ) : null}
          <Pressable style={styles.detailsButton}>
            <ThemedText type="small" style={styles.detailsButtonText}>
              View Details
            </ThemedText>
            <Feather name="chevron-right" size={16} color={Colors.light.accent} />
          </Pressable>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="inbox" size={48} color={Colors.light.textSecondary} />
      <ThemedText type="h4" style={styles.emptyTitle}>
        No tasks found
      </ThemedText>
      <ThemedText type="body" style={styles.emptySubtitle}>
        {taskFilter === "mine"
          ? "You have no assigned tasks"
          : "No tasks match your filters"}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.filterContainer, { marginTop: headerHeight }]}>
        <View style={styles.filterRow}>
          <FilterChip
            label="My Tasks"
            selected={taskFilter === "mine"}
            onPress={() => setTaskFilter("mine")}
          />
          <FilterChip
            label="Today"
            selected={taskFilter === "today"}
            onPress={() => setTaskFilter("today")}
          />
          <FilterChip
            label="All"
            selected={taskFilter === "all"}
            onPress={() => setTaskFilter("all")}
          />
        </View>
        <View style={styles.filterRow}>
          <FilterChip
            label="All Status"
            selected={statusFilter === "all"}
            onPress={() => setStatusFilter("all")}
            small
          />
          <FilterChip
            label="Open"
            selected={statusFilter === "open"}
            onPress={() => setStatusFilter("open")}
            color={Colors.light.statusOpen}
            small
          />
          <FilterChip
            label="In Progress"
            selected={statusFilter === "in_progress"}
            onPress={() => setStatusFilter("in_progress")}
            color={Colors.light.statusInProgress}
            small
          />
          <FilterChip
            label="Done"
            selected={statusFilter === "completed"}
            onPress={() => setStatusFilter("completed")}
            color={Colors.light.statusCompleted}
            small
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
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
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  taskCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  taskIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  taskId: {
    color: Colors.light.primary,
  },
  taskDetails: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  detailText: {
    color: Colors.light.textSecondary,
  },
  taskFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: Spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: `${Colors.light.accent}15`,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  navButtonText: {
    color: Colors.light.accent,
    fontWeight: "600",
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  detailsButtonText: {
    color: Colors.light.accent,
    fontWeight: "600",
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
    textAlign: "center",
  },
});
