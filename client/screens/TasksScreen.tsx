import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { TasksStackParamList } from "@/navigation/TasksStackNavigator";
import { Task, CustomerContainer, TASK_STATUS_LABELS } from "@shared/schema";
import { openMapsNavigation } from "@/lib/navigation";
import { apiRequest } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<TasksStackParamList, "Tasks">;
type StatusFilter = "all" | "available" | "open" | "in_progress" | "completed";

const OPEN_STATUSES = ["OFFEN", "PLANNED", "ASSIGNED"];
const IN_PROGRESS_STATUSES = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
const COMPLETED_STATUSES = ["COMPLETED"];

export default function TasksScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);

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

  const handleQuickClaim = async (taskId: string) => {
    if (!user) return;
    setClaimingTaskId(taskId);
    try {
      const response = await apiRequest("POST", `/api/tasks/${taskId}/claim`, { userId: user.id });
      if (response.status === 409) {
        Alert.alert("Fehler", "Dieser Auftrag wurde bereits von einem anderen Fahrer angenommen.");
        setClaimingTaskId(null);
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        Alert.alert("Fehler", errorData.error || "Auftrag konnte nicht angenommen werden.");
        setClaimingTaskId(null);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/overview"] });
      Alert.alert("Erfolg", "Auftrag erfolgreich angenommen");
    } catch (error) {
      Alert.alert("Fehler", "Auftrag konnte nicht angenommen werden.");
      console.error("Claim task error:", error);
    } finally {
      setClaimingTaskId(null);
    }
  };

  const availableTasks = tasks.filter((task) => 
    task.status === "OFFEN" && !task.claimedByUserId && !task.assignedTo
  );
  const myTasks = tasks.filter((task) => task.assignedTo === user?.id || task.claimedByUserId === user?.id);
  
  const getFilteredTasks = () => {
    if (statusFilter === "available") return availableTasks;
    return myTasks.filter((task) => {
      if (statusFilter === "all") return task.status !== "CANCELLED";
      if (statusFilter === "open") return OPEN_STATUSES.includes(task.status);
      if (statusFilter === "in_progress") return IN_PROGRESS_STATUSES.includes(task.status);
      if (statusFilter === "completed") return COMPLETED_STATUSES.includes(task.status);
      return true;
    });
  };
  
  const filteredTasks = getFilteredTasks();

  const getStatusColor = (status: string) => {
    if (OPEN_STATUSES.includes(status)) return theme.statusOpen;
    if (IN_PROGRESS_STATUSES.includes(status)) return theme.statusInProgress;
    if (COMPLETED_STATUSES.includes(status)) return theme.statusCompleted;
    if (status === "CANCELLED") return theme.statusCancelled;
    return theme.statusOpen;
  };

  const formatDateTime = (date: string | Date | null) => {
    if (!date) return "Nicht geplant";
    const d = new Date(date);
    const day = d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
    const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    return `${day}, ${time}`;
  };

  const getPriorityIcon = (status: string) => {
    if (IN_PROGRESS_STATUSES.includes(status)) return "zap";
    if (OPEN_STATUSES.includes(status)) return "clock";
    return "check-circle";
  };

  const taskCounts = {
    all: myTasks.filter(t => t.status !== "CANCELLED").length,
    available: availableTasks.length,
    open: myTasks.filter(t => OPEN_STATUSES.includes(t.status)).length,
    in_progress: myTasks.filter(t => IN_PROGRESS_STATUSES.includes(t.status)).length,
    completed: myTasks.filter(t => COMPLETED_STATUSES.includes(t.status)).length,
  };

  const renderTask = ({ item }: { item: Task }) => {
    const container = getContainerById(item.containerID);
    const hasLocation = container?.latitude && container?.longitude;
    const isActive = OPEN_STATUSES.includes(item.status) || IN_PROGRESS_STATUSES.includes(item.status);
    const isClaimable = item.status === "OFFEN" && !item.claimedByUserId && !item.assignedTo;
    const isClaiming = claimingTaskId === item.id;

    return (
      <Card
        style={{ backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}
        onPress={() => navigation.navigate("TaskDetail", { taskId: item.id })}
      >
        <View style={styles.taskRow}>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]} />
          <View style={styles.taskContent}>
            <View style={styles.taskMainInfo}>
              <View style={styles.taskTitleRow}>
                <Feather name={getPriorityIcon(item.status) as any} size={18} color={getStatusColor(item.status)} />
                <ThemedText type="bodyBold" style={{ color: theme.text, marginLeft: Spacing.sm }}>
                  {item.containerID}
                </ThemedText>
                <StatusBadge status={item.status} />
              </View>
              
              <View style={styles.taskLocation}>
                <Feather name="map-pin" size={14} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.text, marginLeft: Spacing.xs, flex: 1 }} numberOfLines={1}>
                  {container?.location || "Wird geladen..."}
                </ThemedText>
              </View>

              {container?.customerName ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {container.customerName}
                </ThemedText>
              ) : null}

              <View style={styles.taskMeta}>
                <View style={styles.metaItem}>
                  <Feather name="calendar" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                    {formatDateTime(item.scheduledTime)}
                  </ThemedText>
                </View>
                {item.materialType ? (
                  <View style={styles.metaItem}>
                    <Feather name="tag" size={14} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                      {item.materialType}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>

            {isClaimable ? (
              <Pressable 
                style={[styles.claimButton, { backgroundColor: theme.primary }]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleQuickClaim(item.id);
                }}
                disabled={isClaiming}
              >
                {isClaiming ? (
                  <ActivityIndicator size="small" color={theme.textOnPrimary} />
                ) : (
                  <>
                    <Feather name="user-check" size={16} color={theme.textOnPrimary} />
                    <ThemedText type="captionBold" style={{ color: theme.textOnPrimary, marginTop: 2 }}>
                      Annehmen
                    </ThemedText>
                  </>
                )}
              </Pressable>
            ) : isActive && hasLocation ? (
              <Pressable 
                style={[styles.navButton, { backgroundColor: theme.accent }]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleQuickNavigation(item.containerID);
                }}
              >
                <Feather name="navigation" size={20} color={theme.textOnAccent} />
              </Pressable>
            ) : (
              <View style={styles.chevronContainer}>
                <Feather name="chevron-right" size={24} color={theme.textSecondary} />
              </View>
            )}
          </View>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="inbox" size={48} color={theme.textSecondary} />
      <ThemedText type="h4" style={{ color: theme.text, marginTop: Spacing.lg }}>
        Keine Aufgaben
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
        Ihnen sind derzeit keine Aufgaben zugewiesen
      </ThemedText>
    </View>
  );

  const FilterButton = ({ filter, label, count }: { filter: StatusFilter; label: string; count: number }) => {
    const isSelected = statusFilter === filter;
    return (
      <Pressable
        style={[
          styles.filterButton,
          {
            backgroundColor: isSelected ? theme.primary : theme.cardSurface,
            borderColor: isSelected ? theme.primary : theme.border,
          },
        ]}
        onPress={() => setStatusFilter(filter)}
      >
        <ThemedText 
          type="smallBold" 
          style={{ color: isSelected ? theme.textOnPrimary : theme.text }}
        >
          {label}
        </ThemedText>
        <View style={[
          styles.countBadge, 
          { backgroundColor: isSelected ? theme.accent : theme.backgroundSecondary }
        ]}>
          <ThemedText 
            type="captionBold" 
            style={{ color: isSelected ? theme.textOnAccent : theme.text }}
          >
            {count}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.filterContainer, { marginTop: headerHeight, backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.filterRow}>
          <FilterButton filter="available" label="Verfügbar" count={taskCounts.available} />
          <FilterButton filter="all" label="Meine" count={taskCounts.all} />
          <FilterButton filter="in_progress" label="Aktiv" count={taskCounts.in_progress} />
          <FilterButton filter="completed" label="Erledigt" count={taskCounts.completed} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
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
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    minWidth: 24,
    alignItems: "center",
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
  taskRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  statusIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  taskContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  taskMainInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  taskLocation: {
    flexDirection: "row",
    alignItems: "center",
  },
  taskMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: Spacing.md,
  },
  claimButton: {
    width: 60,
    height: 48,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  chevronContainer: {
    paddingLeft: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.sm,
  },
});
