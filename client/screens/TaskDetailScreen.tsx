import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { TasksStackParamList } from "@/navigation/TasksStackNavigator";
import { Task, CustomerContainer, TASK_STATUS_LABELS } from "@shared/schema";
import { openMapsNavigation } from "@/lib/navigation";
import { apiRequest } from "@/lib/query-client";

type RouteProps = RouteProp<TasksStackParamList, "TaskDetail">;

const ACTIVE_STATUSES = ["OFFEN", "PLANNED", "ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT"];

export default function TaskDetailScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { taskId } = route.params;
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: task, isLoading } = useQuery<Task>({
    queryKey: [`/api/tasks/${taskId}`],
  });
  
  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      Alert.alert("Erfolg", "Auftrag wurde erfolgreich gelöscht", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    },
    onError: (error) => {
      Alert.alert("Fehler", "Auftrag konnte nicht gelöscht werden");
      console.error("Delete task error:", error);
    },
  });

  const { data: container } = useQuery<CustomerContainer>({
    queryKey: [`/api/containers/customer/${task?.containerID}`],
    enabled: !!task?.containerID,
  });

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Nicht geplant";
    const d = new Date(date);
    return d.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleNavigation = async () => {
    if (!container?.latitude || !container?.longitude) {
      Alert.alert(
        "Navigation nicht verfügbar",
        "Standortkoordinaten sind für diesen Container nicht verfügbar.",
        [{ text: "OK" }]
      );
      return;
    }

    await openMapsNavigation({
      latitude: container.latitude,
      longitude: container.longitude,
      label: `${container.customerName} - ${container.location}`,
    });
  };

  const goToScanner = () => {
    const tabNav = navigation.getParent();
    if (tabNav) {
      tabNav.navigate("ScannerTab");
    }
  };

  const handleDeleteTask = () => {
    Alert.alert(
      "Auftrag löschen",
      "Möchten Sie diesen Auftrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: () => {
            setIsDeleting(true);
            deleteTaskMutation.mutate();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
      </ThemedView>
    );
  }

  if (!task) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.errorState}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText type="h4">Aufgabe nicht gefunden</ThemedText>
        </View>
      </ThemedView>
    );
  }

  type FeatherIconName = "plus-circle" | "user-check" | "check-circle" | "log-in" | "truck" | "log-out" | "check-square" | "x-circle" | "circle";

  const lifecycleSteps: { label: string; timestamp: Date | string | null; status: string; icon: FeatherIconName }[] = [
    { label: "Offen", timestamp: task.createdAt, status: "OFFEN", icon: "circle" },
    { label: "Zugewiesen", timestamp: task.assignedAt, status: "ASSIGNED", icon: "user-check" },
    { label: "Angenommen", timestamp: task.acceptedAt, status: "ACCEPTED", icon: "check-circle" },
    { label: "Abgeholt", timestamp: task.pickedUpAt, status: "PICKED_UP", icon: "log-in" },
    { label: "Unterwegs", timestamp: task.inTransitAt, status: "IN_TRANSIT", icon: "truck" },
    { label: "Geliefert", timestamp: task.deliveredAt, status: "DELIVERED", icon: "log-out" },
    { label: "Abgeschlossen", timestamp: task.completedAt, status: "COMPLETED", icon: "check-square" },
  ];

  if (task.status === "CANCELLED") {
    lifecycleSteps.push({ 
      label: "Storniert", 
      timestamp: task.cancelledAt, 
      status: "CANCELLED", 
      icon: "x-circle"
    });
  }

  const hasAnyTimestamp = lifecycleSteps.some(step => step.timestamp);
  const isActive = ACTIVE_STATUSES.includes(task.status);

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.headerCard, { backgroundColor: theme.cardSurface }]}>
          <View style={styles.headerRow}>
            <View style={styles.containerInfo}>
              <Feather name="package" size={32} color={theme.primary} />
              <View>
                <ThemedText type="h3" style={[styles.containerId, { color: theme.primary }]}>
                  {task.containerID}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {task.materialType}
                </ThemedText>
              </View>
            </View>
            <StatusBadge status={task.status} />
          </View>
        </Card>

        <Card style={[styles.infoCard, { backgroundColor: theme.cardSurface }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Abholungsdetails
          </ThemedText>
          
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Standort</ThemedText>
              <ThemedText type="body">{container?.location || "Wird geladen..."}</ThemedText>
              {container?.customerName ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {container.customerName}
                </ThemedText>
              ) : null}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Feather name="clock" size={20} color={theme.textSecondary} />
            <View style={styles.infoContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Geplante Zeit</ThemedText>
              <ThemedText type="body">{formatDate(task.scheduledTime)}</ThemedText>
            </View>
          </View>

          {task.plannedQuantity || task.estimatedAmount ? (
            <View style={styles.infoRow}>
              <Feather name="truck" size={20} color={theme.textSecondary} />
              <View style={styles.infoContent}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Geschätzte Menge</ThemedText>
                <ThemedText type="body">{task.plannedQuantity || task.estimatedAmount} {task.plannedQuantityUnit || "kg"}</ThemedText>
              </View>
            </View>
          ) : null}

          {task.priority && task.priority !== "normal" ? (
            <View style={styles.infoRow}>
              <Feather name="alert-triangle" size={20} color={theme.warning} />
              <View style={styles.infoContent}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Priorität</ThemedText>
                <ThemedText type="body" style={{ color: theme.warning }}>
                  {task.priority === "high" ? "Hoch" : task.priority === "urgent" ? "Dringend" : task.priority}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </Card>

        {task.notes ? (
          <Card style={[styles.notesCard, { backgroundColor: theme.cardSurface }]}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Anweisungen
            </ThemedText>
            <ThemedText type="body">
              {task.notes}
            </ThemedText>
          </Card>
        ) : null}

        {hasAnyTimestamp ? (
          <Card style={[styles.timestampCard, { backgroundColor: theme.cardSurface }]}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Aktivitätsverlauf
            </ThemedText>
            {lifecycleSteps.map((step, index) => {
              if (!step.timestamp && step.status !== task.status) return null;
              const isCompleted = !!step.timestamp;
              const isCurrent = step.status === task.status && !step.timestamp;
              
              let stepColor = theme.textSecondary;
              if (isCompleted) {
                stepColor = step.status === "CANCELLED" ? theme.statusCancelled : theme.statusCompleted;
              } else if (isCurrent) {
                stepColor = theme.statusInProgress;
              }

              return (
                <View key={step.status} style={styles.timestampRow}>
                  <View style={styles.timelineIndicator}>
                    <View style={[styles.timestampDot, { backgroundColor: stepColor }]} />
                    {index < lifecycleSteps.length - 1 && lifecycleSteps[index + 1]?.timestamp ? (
                      <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                    ) : null}
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <Feather name={step.icon} size={16} color={stepColor} />
                      <ThemedText type="body" style={{ marginLeft: Spacing.xs, color: isCompleted ? theme.text : theme.textSecondary }}>
                        {step.label}
                      </ThemedText>
                    </View>
                    {step.timestamp ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {formatDate(step.timestamp)}
                      </ThemedText>
                    ) : isCurrent ? (
                      <ThemedText type="small" style={{ color: theme.statusInProgress }}>
                        Aktueller Status
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}

        {isActive ? (
          <View style={styles.actions}>
            <Button onPress={handleNavigation} style={[styles.secondaryButton, { backgroundColor: theme.cardSurface, borderColor: theme.primary }]}>
              <View style={styles.buttonContent}>
                <Feather name="navigation" size={20} color={theme.primary} />
                <ThemedText type="body" style={{ color: theme.primary, fontWeight: "600" }}>
                  Navigation starten
                </ThemedText>
              </View>
            </Button>
            <Button onPress={goToScanner} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <View style={styles.buttonContent}>
                <Feather name="maximize" size={20} color={theme.textOnAccent} />
                <ThemedText type="body" style={{ color: theme.textOnAccent, fontWeight: "600" }}>
                  QR-Code scannen
                </ThemedText>
              </View>
            </Button>
          </View>
        ) : null}

        {isAdmin ? (
          <Card style={[styles.adminCard, { backgroundColor: theme.cardSurface, borderColor: theme.error }]}>
            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.error }]}>
              Admin-Aktionen
            </ThemedText>
            <Button 
              onPress={handleDeleteTask} 
              disabled={isDeleting || deleteTaskMutation.isPending}
              style={[styles.deleteButton, { backgroundColor: theme.error }]}
            >
              <View style={styles.buttonContent}>
                {isDeleting || deleteTaskMutation.isPending ? (
                  <ActivityIndicator size="small" color={theme.textOnAccent} />
                ) : (
                  <Feather name="trash-2" size={20} color={theme.textOnAccent} />
                )}
                <ThemedText type="body" style={{ color: theme.textOnAccent, fontWeight: "600" }}>
                  {isDeleting || deleteTaskMutation.isPending ? "Wird gelöscht..." : "Auftrag löschen"}
                </ThemedText>
              </View>
            </Button>
          </Card>
        ) : null}
      </ScrollView>
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
  errorState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerCard: {
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  containerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  containerId: {
    fontWeight: "700",
  },
  infoCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  infoContent: {
    flex: 1,
  },
  notesCard: {
    padding: Spacing.lg,
  },
  timestampCard: {
    padding: Spacing.lg,
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.sm,
  },
  timelineIndicator: {
    alignItems: "center",
    width: 24,
  },
  timestampDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginTop: Spacing.xs,
  },
  timelineContent: {
    flex: 1,
    marginLeft: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  primaryButton: {
    paddingVertical: Spacing.lg,
  },
  secondaryButton: {
    borderWidth: 2,
    paddingVertical: Spacing.lg,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  adminCard: {
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
  },
  deleteButton: {
    paddingVertical: Spacing.md,
  },
});
