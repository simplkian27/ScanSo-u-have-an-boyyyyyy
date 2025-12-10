import React, { useState, useMemo } from "react";
import { View, StyleSheet, FlatList, Modal, ActivityIndicator, Pressable, ScrollView, RefreshControl } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { Task, User, CustomerContainer } from "@shared/schema";
import { useTheme } from "@/hooks/useTheme";

type UserWithoutPassword = Omit<User, "password">;
type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";

const STATUS_OPTIONS: { value: TaskStatus; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "open", label: "Offen", icon: "inbox" },
  { value: "in_progress", label: "In Bearbeitung", icon: "truck" },
  { value: "completed", label: "Erledigt", icon: "check-circle" },
  { value: "cancelled", label: "Storniert", icon: "x-circle" },
];

export default function ManageTasksScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newDriver, setNewDriver] = useState<string>("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("open");
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [error, setError] = useState<string>("");

  const { data: tasks = [], isLoading, refetch, isRefetching } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: users = [] } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
  });

  const { data: containers = [] } = useQuery<CustomerContainer[]>({
    queryKey: ["/api/containers/customer"],
  });

  const drivers = users.filter((u) => u.role === "driver" && u.isActive);

  const filteredTasks = useMemo(() => {
    let sorted = [...tasks].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (filterStatus !== "all") {
      sorted = sorted.filter((t) => t.status === filterStatus);
    }
    return sorted;
  }, [tasks, filterStatus]);

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return "Nicht zugewiesen";
    const driver = users.find((u) => u.id === driverId);
    return driver?.name || "Unbekannt";
  };

  const getContainerInfo = (containerId: string) => {
    const container = containers.find((c) => c.id === containerId);
    return container ? `${container.customerName} - ${container.location}` : containerId;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return theme.statusOpen || theme.warning;
      case "in_progress": return theme.statusInProgress || theme.info;
      case "completed": return theme.statusCompleted || theme.success;
      case "cancelled": return theme.error;
      default: return theme.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    const option = STATUS_OPTIONS.find((o) => o.value === status);
    return option?.label || status;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return theme.error;
      case "high": return theme.warning;
      default: return theme.textSecondary;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "urgent": return "Dringend";
      case "high": return "Hoch";
      default: return "Normal";
    }
  };

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setNewDriver(task.assignedTo || "");
    setNewStatus(task.status as TaskStatus);
    setCancellationReason(task.cancellationReason || "");
    setError("");
    setShowEditModal(true);
  };

  const canChangeToStatus = (currentStatus: string, targetStatus: TaskStatus): boolean => {
    if (currentStatus === "completed") return false;
    if (currentStatus === "cancelled") return targetStatus === "open";
    return true;
  };

  const getDisabledStatusReason = (currentStatus: string, targetStatus: TaskStatus): string | null => {
    if (currentStatus === "completed" && targetStatus !== "completed") {
      return "Erledigte Aufgaben können nicht geändert werden";
    }
    if (currentStatus === "cancelled" && targetStatus !== "open" && targetStatus !== "cancelled") {
      return "Stornierte Aufgaben können nur wieder geöffnet werden";
    }
    return null;
  };

  const handleUpdateTask = async () => {
    if (!selectedTask) return;

    setError("");

    if (newStatus === "cancelled" && !cancellationReason.trim()) {
      setError("Bitte geben Sie einen Stornierungsgrund an");
      return;
    }

    if (!canChangeToStatus(selectedTask.status, newStatus)) {
      const reason = getDisabledStatusReason(selectedTask.status, newStatus);
      if (reason) {
        setError(reason);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const updates: Record<string, unknown> = {};
      
      if (newDriver !== selectedTask.assignedTo) {
        updates.assignedTo = newDriver || null;
      }
      
      if (newStatus !== selectedTask.status) {
        updates.status = newStatus;
        if (newStatus === "cancelled") {
          updates.cancellationReason = cancellationReason.trim();
        }
      }

      if (Object.keys(updates).length > 0) {
        await apiRequest("PATCH", `/api/tasks/${selectedTask.id}`, updates);
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/activity-logs"] });
      }

      setShowEditModal(false);
      setSelectedTask(null);
    } catch (err) {
      console.error("Failed to update task:", err);
      setError("Aufgabe konnte nicht aktualisiert werden");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderTask = ({ item }: { item: Task }) => (
    <Card
      style={{ ...styles.taskCard, backgroundColor: theme.cardSurface }}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskInfo}>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <ThemedText type="caption" style={{ color: getStatusColor(item.status), fontWeight: "600" }}>
              {getStatusLabel(item.status)}
            </ThemedText>
          </View>
          {item.priority !== "normal" ? (
            <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(item.priority)}20` }]}>
              <Feather name="alert-triangle" size={10} color={getPriorityColor(item.priority)} />
              <ThemedText type="caption" style={{ color: getPriorityColor(item.priority), fontWeight: "600" }}>
                {getPriorityLabel(item.priority)}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <Pressable
          style={styles.editButton}
          onPress={() => openEditModal(item)}
          hitSlop={8}
        >
          <Feather name="edit-2" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.taskDetails}>
        <View style={styles.detailRow}>
          <Feather name="package" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.text, flex: 1 }}>
            {getContainerInfo(item.containerID)}
          </ThemedText>
        </View>
        <View style={styles.detailRow}>
          <Feather name="layers" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.materialType}
          </ThemedText>
          {item.estimatedAmount ? (
            <ThemedText type="caption" style={{ color: theme.textTertiary }}>
              ~{item.estimatedAmount} kg
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={[styles.assigneeRow, { borderTopColor: theme.divider }]}>
        <View style={styles.assigneeInfo}>
          {item.assignedTo ? (
            <>
              <View style={[styles.driverAvatar, { backgroundColor: theme.primary }]}>
                <ThemedText type="caption" style={styles.avatarText}>
                  {getInitials(getDriverName(item.assignedTo))}
                </ThemedText>
              </View>
              <View>
                <ThemedText type="small" style={{ color: theme.text, fontWeight: "600" }}>
                  {getDriverName(item.assignedTo)}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Zugewiesen
                </ThemedText>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.driverAvatar, { backgroundColor: theme.textTertiary }]}>
                <Feather name="user-x" size={12} color="#FFFFFF" />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Nicht zugewiesen
              </ThemedText>
            </>
          )}
        </View>
        <ThemedText type="caption" style={{ color: theme.textTertiary }}>
          {formatDate(item.createdAt)}
        </ThemedText>
      </View>
    </Card>
  );

  const renderFilterButtons = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterContainer}
      contentContainerStyle={styles.filterContent}
    >
      <Pressable
        style={[
          styles.filterButton,
          { borderColor: theme.border },
          filterStatus === "all" && { backgroundColor: theme.primary, borderColor: theme.primary },
        ]}
        onPress={() => setFilterStatus("all")}
      >
        <ThemedText
          type="small"
          style={[
            styles.filterText,
            { color: filterStatus === "all" ? "#FFFFFF" : theme.text },
          ]}
        >
          Alle ({tasks.length})
        </ThemedText>
      </Pressable>
      {STATUS_OPTIONS.map((option) => {
        const count = tasks.filter((t) => t.status === option.value).length;
        return (
          <Pressable
            key={option.value}
            style={[
              styles.filterButton,
              { borderColor: theme.border },
              filterStatus === option.value && {
                backgroundColor: getStatusColor(option.value),
                borderColor: getStatusColor(option.value),
              },
            ]}
            onPress={() => setFilterStatus(option.value)}
          >
            <Feather
              name={option.icon}
              size={14}
              color={filterStatus === option.value ? "#FFFFFF" : getStatusColor(option.value)}
            />
            <ThemedText
              type="small"
              style={[
                styles.filterText,
                { color: filterStatus === option.value ? "#FFFFFF" : theme.text },
              ]}
            >
              {option.label} ({count})
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="clipboard" size={48} color={theme.textSecondary} />
      <ThemedText type="h4" style={[styles.emptyTitle, { color: theme.text }]}>
        Keine Aufgaben gefunden
      </ThemedText>
      <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {filterStatus === "all"
          ? "Erstellen Sie eine neue Aufgabe, um zu beginnen"
          : `Keine Aufgaben mit Status "${getStatusLabel(filterStatus)}"`}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { marginTop: headerHeight }]}>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {filteredTasks.length} Aufgaben
        </ThemedText>
      </View>

      {renderFilterButtons()}

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
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.accent}
            />
          }
        />
      )}

      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3" style={{ color: theme.text }}>
                Aufgabe bearbeiten
              </ThemedText>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={styles.closeButton}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {selectedTask ? (
              <ScrollView style={styles.modalBody}>
                <View style={[styles.taskSummary, { backgroundColor: theme.cardSurface }]}>
                  <View style={styles.summaryRow}>
                    <Feather name="package" size={16} color={theme.textSecondary} />
                    <ThemedText type="body" style={{ color: theme.text, flex: 1 }}>
                      {getContainerInfo(selectedTask.containerID)}
                    </ThemedText>
                  </View>
                  <View style={styles.summaryRow}>
                    <Feather name="layers" size={16} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {selectedTask.materialType}
                      {selectedTask.estimatedAmount ? ` - ~${selectedTask.estimatedAmount} kg` : ""}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.section}>
                  <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
                    Status ändern
                  </ThemedText>
                  <View style={styles.statusGrid}>
                    {STATUS_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.statusOption,
                          { borderColor: theme.border },
                          newStatus === option.value && {
                            backgroundColor: `${getStatusColor(option.value)}20`,
                            borderColor: getStatusColor(option.value),
                          },
                        ]}
                        onPress={() => setNewStatus(option.value)}
                      >
                        <Feather
                          name={option.icon}
                          size={20}
                          color={newStatus === option.value ? getStatusColor(option.value) : theme.textSecondary}
                        />
                        <ThemedText
                          type="small"
                          style={{
                            color: newStatus === option.value ? getStatusColor(option.value) : theme.text,
                            fontWeight: newStatus === option.value ? "600" : "400",
                          }}
                        >
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                  {newStatus === "cancelled" ? (
                    <View style={styles.cancellationReasonContainer}>
                      <TextInput
                        label="Stornierungsgrund *"
                        value={cancellationReason}
                        onChangeText={setCancellationReason}
                        placeholder="Grund für die Stornierung eingeben..."
                        multiline
                        numberOfLines={2}
                      />
                    </View>
                  ) : null}
                  {selectedTask && selectedTask.status === "completed" ? (
                    <View style={[styles.warningBanner, { backgroundColor: theme.warningLight }]}>
                      <Feather name="alert-triangle" size={16} color={theme.warning} />
                      <ThemedText type="small" style={{ color: theme.warning, flex: 1 }}>
                        Erledigte Aufgaben können nicht mehr geändert werden
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                <View style={styles.section}>
                  <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
                    Fahrer zuweisen
                  </ThemedText>
                  <View style={styles.driverList}>
                    <Pressable
                      style={[
                        styles.driverOption,
                        { borderColor: theme.border },
                        newDriver === "" && {
                          backgroundColor: `${theme.textSecondary}20`,
                          borderColor: theme.textSecondary,
                        },
                      ]}
                      onPress={() => setNewDriver("")}
                    >
                      <View style={[styles.driverAvatar, { backgroundColor: theme.textTertiary }]}>
                        <Feather name="user-x" size={14} color="#FFFFFF" />
                      </View>
                      <ThemedText
                        type="small"
                        style={{
                          color: newDriver === "" ? theme.text : theme.textSecondary,
                          fontWeight: newDriver === "" ? "600" : "400",
                          flex: 1,
                        }}
                      >
                        Nicht zuweisen
                      </ThemedText>
                      {newDriver === "" ? (
                        <Feather name="check" size={18} color={theme.success} />
                      ) : null}
                    </Pressable>
                    {drivers.map((driver) => (
                      <Pressable
                        key={driver.id}
                        style={[
                          styles.driverOption,
                          { borderColor: theme.border },
                          newDriver === driver.id && {
                            backgroundColor: `${theme.primary}20`,
                            borderColor: theme.primary,
                          },
                        ]}
                        onPress={() => setNewDriver(driver.id)}
                      >
                        <View style={[styles.driverAvatar, { backgroundColor: theme.primary }]}>
                          <ThemedText type="caption" style={styles.avatarText}>
                            {getInitials(driver.name)}
                          </ThemedText>
                        </View>
                        <ThemedText
                          type="small"
                          style={{
                            color: newDriver === driver.id ? theme.primary : theme.text,
                            fontWeight: newDriver === driver.id ? "600" : "400",
                            flex: 1,
                          }}
                        >
                          {driver.name}
                        </ThemedText>
                        {newDriver === driver.id ? (
                          <Feather name="check" size={18} color={theme.success} />
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                  {drivers.length === 0 ? (
                    <ThemedText type="small" style={[styles.noDrivers, { color: theme.textSecondary }]}>
                      Keine aktiven Fahrer verfügbar
                    </ThemedText>
                  ) : null}
                </View>
              </ScrollView>
            ) : null}

            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: theme.errorLight }]}>
                <Feather name="alert-circle" size={16} color={theme.error} />
                <ThemedText type="small" style={{ color: theme.error, flex: 1 }}>
                  {error}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Button
                style={[styles.cancelButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => setShowEditModal(false)}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  Abbrechen
                </ThemedText>
              </Button>
              <Button
                style={styles.submitButton}
                onPress={handleUpdateTask}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText type="body" style={styles.submitText}>
                    Speichern
                  </ThemedText>
                )}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  filterContainer: {
    maxHeight: 50,
  },
  filterContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  filterText: {
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  taskCard: {
    marginBottom: Spacing.sm,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  taskInfo: {
    flexDirection: "row",
    gap: Spacing.sm,
    flex: 1,
    flexWrap: "wrap",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  editButton: {
    padding: Spacing.xs,
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
  assigneeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  assigneeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  driverAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 10,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontWeight: "600",
  },
  emptySubtitle: {
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalBody: {
    padding: Spacing.lg,
    maxHeight: 500,
  },
  taskSummary: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    fontWeight: "600",
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  driverList: {
    gap: Spacing.sm,
  },
  driverOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  noDrivers: {
    textAlign: "center",
    padding: Spacing.lg,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  cancellationReasonContainer: {
    marginTop: Spacing.md,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
});
