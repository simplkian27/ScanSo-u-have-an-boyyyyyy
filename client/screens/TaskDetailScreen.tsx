import React from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, Platform } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { TasksStackParamList } from "@/navigation/TasksStackNavigator";
import { Task, CustomerContainer } from "@shared/schema";

type RouteProps = RouteProp<TasksStackParamList, "TaskDetail">;

export default function TaskDetailScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { taskId } = route.params;

  const { data: task, isLoading } = useQuery<Task>({
    queryKey: [`/api/tasks/${taskId}`],
  });

  const { data: container } = useQuery<CustomerContainer>({
    queryKey: [`/api/containers/customer/${task?.containerID}`],
    enabled: !!task?.containerID,
  });

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Not scheduled";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openMaps = () => {
    const lat = 52.520008;
    const lng = 13.404954;
    const label = container?.location || "Container Location";
    
    const scheme = Platform.select({
      ios: "maps:",
      android: "geo:",
    });
    const url = Platform.select({
      ios: `${scheme}?q=${label}&ll=${lat},${lng}`,
      android: `${scheme}${lat},${lng}?q=${lat},${lng}(${label})`,
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  const goToScanner = () => {
    const tabNav = navigation.getParent();
    if (tabNav) {
      tabNav.navigate("ScannerTab");
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
      </ThemedView>
    );
  }

  if (!task) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorState}>
          <Feather name="alert-circle" size={48} color={Colors.light.error} />
          <ThemedText type="h4">Task not found</ThemedText>
        </View>
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
      >
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.containerInfo}>
              <Feather name="package" size={32} color={Colors.light.primary} />
              <View>
                <ThemedText type="h3" style={styles.containerId}>
                  {task.containerID}
                </ThemedText>
                <ThemedText type="small" style={styles.materialType}>
                  {task.materialType}
                </ThemedText>
              </View>
            </View>
            <StatusBadge status={task.status} />
          </View>
        </Card>

        <Card style={styles.infoCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Pickup Details
          </ThemedText>
          
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={20} color={Colors.light.textSecondary} />
            <View style={styles.infoContent}>
              <ThemedText type="small" style={styles.infoLabel}>Location</ThemedText>
              <ThemedText type="body">{container?.location || "Loading..."}</ThemedText>
              {container?.customerName ? (
                <ThemedText type="small" style={styles.infoSecondary}>
                  {container.customerName}
                </ThemedText>
              ) : null}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Feather name="clock" size={20} color={Colors.light.textSecondary} />
            <View style={styles.infoContent}>
              <ThemedText type="small" style={styles.infoLabel}>Scheduled Time</ThemedText>
              <ThemedText type="body">{formatDate(task.scheduledTime)}</ThemedText>
            </View>
          </View>

          {task.estimatedAmount ? (
            <View style={styles.infoRow}>
              <Feather name="truck" size={20} color={Colors.light.textSecondary} />
              <View style={styles.infoContent}>
                <ThemedText type="small" style={styles.infoLabel}>Estimated Amount</ThemedText>
                <ThemedText type="body">{task.estimatedAmount} kg</ThemedText>
              </View>
            </View>
          ) : null}

          {task.priority && task.priority !== "normal" ? (
            <View style={styles.infoRow}>
              <Feather name="alert-triangle" size={20} color={Colors.light.warning} />
              <View style={styles.infoContent}>
                <ThemedText type="small" style={styles.infoLabel}>Priority</ThemedText>
                <ThemedText type="body" style={{ color: Colors.light.warning }}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </Card>

        {task.notes ? (
          <Card style={styles.notesCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Instructions
            </ThemedText>
            <ThemedText type="body" style={styles.notes}>
              {task.notes}
            </ThemedText>
          </Card>
        ) : null}

        {task.pickupTimestamp ? (
          <Card style={styles.timestampCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Activity
            </ThemedText>
            <View style={styles.timestampRow}>
              <View style={[styles.timestampDot, { backgroundColor: Colors.light.statusInProgress }]} />
              <View>
                <ThemedText type="body">Picked up</ThemedText>
                <ThemedText type="small" style={styles.infoSecondary}>
                  {formatDate(task.pickupTimestamp)}
                </ThemedText>
              </View>
            </View>
            {task.deliveryTimestamp ? (
              <View style={styles.timestampRow}>
                <View style={[styles.timestampDot, { backgroundColor: Colors.light.statusCompleted }]} />
                <View>
                  <ThemedText type="body">Delivered to {task.deliveryContainerID}</ThemedText>
                  <ThemedText type="small" style={styles.infoSecondary}>
                    {formatDate(task.deliveryTimestamp)}
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}

        {task.status === "open" || task.status === "in_progress" ? (
          <View style={styles.actions}>
            <Button onPress={openMaps} style={styles.secondaryButton}>
              <View style={styles.buttonContent}>
                <Feather name="navigation" size={20} color={Colors.light.primary} />
                <ThemedText type="body" style={{ color: Colors.light.primary, fontWeight: "600" }}>
                  Start Navigation
                </ThemedText>
              </View>
            </Button>
            <Button onPress={goToScanner} style={styles.primaryButton}>
              <View style={styles.buttonContent}>
                <Feather name="maximize" size={20} color="#FFFFFF" />
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Scan QR Code
                </ThemedText>
              </View>
            </Button>
          </View>
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
    backgroundColor: Colors.light.backgroundDefault,
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
    color: Colors.light.primary,
  },
  materialType: {
    color: Colors.light.textSecondary,
  },
  infoCard: {
    backgroundColor: Colors.light.backgroundDefault,
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
  infoLabel: {
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  infoSecondary: {
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  notesCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  notes: {
    color: Colors.light.text,
  },
  timestampCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  timestampDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  primaryButton: {
    backgroundColor: Colors.light.accent,
  },
  secondaryButton: {
    backgroundColor: Colors.light.backgroundDefault,
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
