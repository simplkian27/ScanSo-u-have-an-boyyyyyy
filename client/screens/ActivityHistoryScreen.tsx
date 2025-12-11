import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Modal,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { FilterChip } from "@/components/FilterChip";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, IndustrialDesign } from "@/constants/theme";
import { ActivityLog, User, Task, ACTIVITY_LOG_TYPE_LABELS, TASK_STATUS_LABELS } from "@shared/schema";

type UserWithoutPassword = Omit<User, "password">;
type TypeFilter = "all" | "TASK_ACCEPTED" | "TASK_COMPLETED" | "TASK_CANCELLED";

interface GroupedActivity {
  date: string;
  formattedDate: string;
  items: ActivityLog[];
}

export default function ActivityHistoryScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const { data: logs = [], isLoading: logsLoading, refetch, isRefetching } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const isLoading = logsLoading || usersLoading || tasksLoading;

  const getUserName = (userId: string | null): string => {
    if (!userId) return "System";
    const user = users.find((u) => u.id === userId);
    return user?.name || "Unbekannter Benutzer";
  };

  const getTask = (taskId: string | null): Task | undefined => {
    if (!taskId) return undefined;
    return tasks.find((t) => t.id === taskId);
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "TASK_CREATED":
        return { icon: "plus-circle" as const, color: theme.statusOpen };
      case "TASK_ASSIGNED":
        return { icon: "user-check" as const, color: theme.statusOpen };
      case "TASK_ACCEPTED":
        return { icon: "check-circle" as const, color: theme.statusInProgress };
      case "TASK_PICKED_UP":
        return { icon: "log-in" as const, color: theme.statusInProgress };
      case "TASK_IN_TRANSIT":
        return { icon: "truck" as const, color: theme.statusInProgress };
      case "TASK_DELIVERED":
        return { icon: "log-out" as const, color: theme.statusCompleted };
      case "TASK_COMPLETED":
        return { icon: "check-square" as const, color: theme.statusCompleted };
      case "TASK_CANCELLED":
        return { icon: "x-circle" as const, color: theme.statusCancelled };
      case "CONTAINER_SCANNED_AT_CUSTOMER":
      case "CONTAINER_SCANNED_AT_WAREHOUSE":
        return { icon: "maximize" as const, color: theme.primary };
      case "WEIGHT_RECORDED":
        return { icon: "database" as const, color: theme.primary };
      case "MANUAL_EDIT":
        return { icon: "edit" as const, color: theme.primary };
      default:
        return { icon: "activity" as const, color: theme.textSecondary };
    }
  };

  const formatTime = (date: string | Date): string => {
    const d = new Date(date);
    return d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateHeader = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Heute";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Gestern";
    }
    return date.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (typeFilter !== "all" && log.type !== typeFilter) {
        return false;
      }
      if (selectedDriverId && log.userId !== selectedDriverId) {
        return false;
      }
      if (dateFrom) {
        const logDate = new Date(log.createdAt);
        if (logDate < dateFrom) return false;
      }
      if (dateTo) {
        const logDate = new Date(log.createdAt);
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (logDate > endOfDay) return false;
      }
      return true;
    });
  }, [logs, typeFilter, selectedDriverId, dateFrom, dateTo]);

  const groupedActivities = useMemo((): GroupedActivity[] => {
    const groups: Record<string, ActivityLog[]> = {};

    filteredLogs.forEach((log) => {
      const date = new Date(log.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(log);
    });

    return Object.entries(groups)
      .map(([date, items]) => ({
        date,
        formattedDate: formatDateHeader(date),
        items: items.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredLogs]);

  const drivers = useMemo(() => {
    return users.filter((u) => u.role === "DRIVER" || u.role === "ADMIN" || u.role === "driver" || u.role === "admin");
  }, [users]);

  const selectedDriverName = selectedDriverId
    ? getUserName(selectedDriverId)
    : "Alle Fahrer";

  const clearFilters = () => {
    setTypeFilter("all");
    setSelectedDriverId(null);
    setDateFrom(null);
    setDateTo(null);
  };

  const hasActiveFilters = typeFilter !== "all" || selectedDriverId !== null || dateFrom !== null || dateTo !== null;

  const renderTaskLifecycle = (task: Task) => {
    const lifecycleSteps: Array<{
      label: string;
      timestamp: Date | string | null;
      icon: keyof typeof Feather.glyphMap;
      color: string;
      completed: boolean;
    }> = [
      {
        label: "Auftrag erstellt",
        timestamp: task.createdAt,
        icon: "plus-circle",
        color: theme.statusOpen,
        completed: true,
      },
      {
        label: "Zugewiesen",
        timestamp: task.assignedAt,
        icon: "user-check",
        color: theme.statusOpen,
        completed: !!task.assignedAt,
      },
      {
        label: "Angenommen",
        timestamp: task.acceptedAt,
        icon: "check-circle",
        color: theme.statusInProgress,
        completed: !!task.acceptedAt,
      },
      {
        label: "Abgeholt",
        timestamp: task.pickedUpAt,
        icon: "log-in",
        color: theme.statusInProgress,
        completed: !!task.pickedUpAt,
      },
      {
        label: "Unterwegs",
        timestamp: task.inTransitAt,
        icon: "truck",
        color: theme.statusInProgress,
        completed: !!task.inTransitAt,
      },
      {
        label: "Im Lager geliefert",
        timestamp: task.deliveredAt,
        icon: "log-out",
        color: theme.statusCompleted,
        completed: !!task.deliveredAt,
      },
      {
        label: "Abgeschlossen",
        timestamp: task.completedAt,
        icon: "check-square",
        color: theme.statusCompleted,
        completed: !!task.completedAt,
      },
    ];

    if (task.status === "CANCELLED") {
      lifecycleSteps.push({
        label: "Storniert",
        timestamp: task.cancelledAt,
        icon: "x-circle",
        color: theme.statusCancelled,
        completed: true,
      });
    }

    return (
      <View style={styles.lifecycleContainer}>
        {lifecycleSteps.filter(step => step.completed || step.timestamp).map((step, index) => (
          <View key={step.label} style={styles.lifecycleStep}>
            <View style={styles.lifecycleIconRow}>
              <View
                style={[
                  styles.lifecycleIcon,
                  {
                    backgroundColor: step.completed ? `${step.color}20` : `${theme.textSecondary}10`,
                    borderColor: step.completed ? step.color : theme.border,
                  },
                ]}
              >
                <Feather
                  name={step.icon}
                  size={16}
                  color={step.completed ? step.color : theme.textSecondary}
                />
              </View>
              {index < lifecycleSteps.filter(s => s.completed || s.timestamp).length - 1 ? (
                <View
                  style={[
                    styles.lifecycleLine,
                    {
                      backgroundColor: step.completed ? step.color : theme.border,
                    },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.lifecycleContent}>
              <ThemedText
                type="small"
                style={[
                  styles.lifecycleLabel,
                  { color: step.completed ? theme.text : theme.textSecondary },
                ]}
              >
                {step.label}
              </ThemedText>
              {step.timestamp ? (
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {new Date(step.timestamp).toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </ThemedText>
              ) : (
                <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                  Ausstehend
                </ThemedText>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderLogItem = ({ item }: { item: ActivityLog }) => {
    const config = getTypeConfig(item.type);
    const task = getTask(item.taskId);
    const typeLabel = ACTIVITY_LOG_TYPE_LABELS[item.type] || item.type;

    const getStatusFromType = (type: string) => {
      if (type.includes("ACCEPTED") || type.includes("PICKED_UP") || type.includes("IN_TRANSIT")) return "ACCEPTED";
      if (type.includes("COMPLETED") || type.includes("DELIVERED")) return "COMPLETED";
      if (type.includes("CANCELLED")) return "CANCELLED";
      return "PLANNED";
    };

    return (
      <Card style={{ ...styles.logCard, backgroundColor: theme.cardSurface }}>
        <View style={styles.logHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${config.color}20` }]}>
            <Feather name={config.icon} size={20} color={config.color} />
          </View>
          <View style={styles.logMainContent}>
            <View style={styles.logTitleRow}>
              <StatusBadge
                status={getStatusFromType(item.type)}
                label={typeLabel}
                size="small"
              />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatTime(item.timestamp || item.createdAt)}
              </ThemedText>
            </View>
            <View style={styles.logInfoRow}>
              <Feather name="user" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.xs }}>
                {getUserName(item.userId)}
              </ThemedText>
            </View>
            {item.taskId ? (
              <View style={styles.logInfoRow}>
                <Feather name="clipboard" size={14} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                  Aufgabe: {item.taskId.substring(0, 8)}...
                </ThemedText>
              </View>
            ) : null}
            {item.containerId ? (
              <View style={styles.logInfoRow}>
                <Feather name="package" size={14} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                  Container: {item.containerId}
                </ThemedText>
              </View>
            ) : null}
            {item.message ? (
              <ThemedText type="small" style={[styles.logDetails, { color: theme.text }]}>
                {item.message}
              </ThemedText>
            ) : null}
            {task ? renderTaskLifecycle(task) : null}
          </View>
        </View>
      </Card>
    );
  };

  const renderDateGroup = ({ item }: { item: GroupedActivity }) => (
    <View style={styles.dateGroup}>
      <View style={[styles.dateHeader, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="calendar" size={16} color={theme.primary} />
        <ThemedText type="bodyBold" style={{ color: theme.primary, marginLeft: Spacing.sm }}>
          {item.formattedDate}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
          ({item.items.length} Einträge)
        </ThemedText>
      </View>
      {item.items.map((log) => (
        <View key={log.id}>{renderLogItem({ item: log })}</View>
      ))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="inbox" size={48} color={theme.textSecondary} />
      <ThemedText type="h4" style={[styles.emptyTitle, { color: theme.text }]}>
        Keine Aktivitäten
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
        {hasActiveFilters
          ? "Keine Einträge für die ausgewählten Filter gefunden"
          : "Aktivitätsprotokolle werden hier angezeigt"}
      </ThemedText>
      {hasActiveFilters ? (
        <Pressable
          style={[styles.clearFiltersButton, { backgroundColor: theme.accent }]}
          onPress={clearFilters}
        >
          <ThemedText type="bodyBold" style={{ color: theme.textOnAccent }}>
            Filter zurücksetzen
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );

  const renderDriverPicker = () => (
    <Modal
      visible={showDriverPicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDriverPicker(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setShowDriverPicker(false)}
      >
        <View style={[styles.pickerModal, { backgroundColor: theme.cardSurface }]}>
          <ThemedText type="h4" style={[styles.pickerTitle, { color: theme.text }]}>
            Fahrer auswählen
          </ThemedText>
          <ScrollView style={styles.pickerList}>
            <Pressable
              style={[
                styles.pickerItem,
                selectedDriverId === null && { backgroundColor: `${theme.accent}20` },
              ]}
              onPress={() => {
                setSelectedDriverId(null);
                setShowDriverPicker(false);
              }}
            >
              <Feather
                name="users"
                size={20}
                color={selectedDriverId === null ? theme.accent : theme.textSecondary}
              />
              <ThemedText
                type="body"
                style={{
                  color: selectedDriverId === null ? theme.accent : theme.text,
                  marginLeft: Spacing.md,
                }}
              >
                Alle Fahrer
              </ThemedText>
              {selectedDriverId === null ? (
                <Feather name="check" size={20} color={theme.accent} style={styles.checkIcon} />
              ) : null}
            </Pressable>
            {drivers.map((driver) => (
              <Pressable
                key={driver.id}
                style={[
                  styles.pickerItem,
                  selectedDriverId === driver.id && { backgroundColor: `${theme.accent}20` },
                ]}
                onPress={() => {
                  setSelectedDriverId(driver.id);
                  setShowDriverPicker(false);
                }}
              >
                <Feather
                  name="user"
                  size={20}
                  color={selectedDriverId === driver.id ? theme.accent : theme.textSecondary}
                />
                <ThemedText
                  type="body"
                  style={{
                    color: selectedDriverId === driver.id ? theme.accent : theme.text,
                    marginLeft: Spacing.md,
                    flex: 1,
                  }}
                >
                  {driver.name}
                </ThemedText>
                {selectedDriverId === driver.id ? (
                  <Feather name="check" size={20} color={theme.accent} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            style={[styles.closeButton, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => setShowDriverPicker(false)}
          >
            <ThemedText type="body" style={{ color: theme.text }}>
              Schließen
            </ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Aktivitäten werden geladen...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {renderDriverPicker()}
      
      <View style={[styles.filterContainer, { marginTop: headerHeight, backgroundColor: theme.backgroundDefault }]}>
        <Pressable
          style={[styles.driverSelector, { borderColor: theme.border, backgroundColor: theme.cardSurface }]}
          onPress={() => setShowDriverPicker(true)}
        >
          <Feather name="user" size={18} color={theme.primary} />
          <ThemedText type="body" style={{ color: theme.text, flex: 1, marginLeft: Spacing.sm }}>
            {selectedDriverName}
          </ThemedText>
          <Feather name="chevron-down" size={18} color={theme.textSecondary} />
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
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
        </ScrollView>

        {hasActiveFilters ? (
          <Pressable
            style={[styles.clearFiltersSmall, { backgroundColor: `${theme.error}15` }]}
            onPress={clearFilters}
          >
            <Feather name="x" size={14} color={theme.error} />
            <ThemedText type="caption" style={{ color: theme.error, marginLeft: Spacing.xs }}>
              Filter zurücksetzen
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={groupedActivities}
        keyExtractor={(item) => item.date}
        renderItem={renderDateGroup}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  driverSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    minHeight: IndustrialDesign.minTouchTarget,
  },
  filterScroll: {
    marginTop: Spacing.xs,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  clearFiltersSmall: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  dateGroup: {
    gap: Spacing.sm,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  logCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
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
  logMainContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  logTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  logInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logDetails: {
    marginTop: Spacing.xs,
    fontStyle: "italic",
  },
  lifecycleContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  lifecycleStep: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  lifecycleIconRow: {
    alignItems: "center",
    width: 32,
  },
  lifecycleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  lifecycleLine: {
    width: 2,
    flex: 1,
    marginTop: Spacing.xs,
  },
  lifecycleContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  lifecycleLabel: {
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
    fontWeight: "700",
  },
  clearFiltersButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  pickerModal: {
    width: "100%",
    maxHeight: "70%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  pickerTitle: {
    marginBottom: Spacing.lg,
    textAlign: "center",
    fontWeight: "700",
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  checkIcon: {
    marginLeft: "auto",
  },
  closeButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
});
