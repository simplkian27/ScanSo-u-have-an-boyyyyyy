import React from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/Button";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { ContainersStackParamList } from "@/navigation/ContainersStackNavigator";
import { CustomerContainer, WarehouseContainer, FillHistory } from "@shared/schema";
import { openMapsNavigation } from "@/lib/navigation";

type RouteProps = RouteProp<ContainersStackParamList, "ContainerDetail">;

export default function ContainerDetailScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const route = useRoute<RouteProps>();
  const { containerId, type } = route.params;

  const { data: container, isLoading } = useQuery<CustomerContainer | WarehouseContainer>({
    queryKey: [`/api/containers/${type}/${containerId}`],
  });

  const { data: fillHistory = [] } = useQuery<FillHistory[]>({
    queryKey: [`/api/containers/warehouse/${containerId}/history`],
    enabled: type === "warehouse",
  });

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFillColor = (percentage: number) => {
    if (percentage >= 80) return Colors.light.fillHigh;
    if (percentage >= 51) return Colors.light.fillMedium;
    return Colors.light.fillLow;
  };

  const handleNavigation = async () => {
    const customerContainer = container as CustomerContainer;
    if (!customerContainer?.latitude || !customerContainer?.longitude) {
      Alert.alert(
        "Navigation Unavailable",
        "Location coordinates are not available for this container.",
        [{ text: "OK" }]
      );
      return;
    }

    await openMapsNavigation({
      latitude: customerContainer.latitude,
      longitude: customerContainer.longitude,
      label: `${customerContainer.customerName} - ${customerContainer.location}`,
    });
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
      </ThemedView>
    );
  }

  if (!container) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorState}>
          <Feather name="alert-circle" size={48} color={Colors.light.error} />
          <ThemedText type="h4">Container not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const isWarehouse = type === "warehouse";
  const warehouseContainer = container as WarehouseContainer;
  const customerContainer = container as CustomerContainer;
  const fillPercentage = isWarehouse
    ? (warehouseContainer.currentAmount / warehouseContainer.maxCapacity) * 100
    : 0;

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
              <Feather name="package" size={40} color={Colors.light.primary} />
              <View>
                <ThemedText type="h3" style={styles.containerId}>
                  {container.id}
                </ThemedText>
                <ThemedText type="body" style={styles.location}>
                  {container.location}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.materialBadge}>
            <Feather name="tag" size={16} color={Colors.light.primary} />
            <ThemedText type="body" style={styles.materialText}>
              {container.materialType}
            </ThemedText>
          </View>
        </Card>

        {isWarehouse ? (
          <Card style={styles.fillCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Fill Level
            </ThemedText>
            
            <View style={styles.fillStats}>
              <View style={styles.fillStatItem}>
                <ThemedText type="h2" style={[styles.fillValue, { color: getFillColor(fillPercentage) }]}>
                  {fillPercentage.toFixed(0)}%
                </ThemedText>
                <ThemedText type="small" style={styles.fillLabel}>Current</ThemedText>
              </View>
              <View style={styles.fillStatDivider} />
              <View style={styles.fillStatItem}>
                <ThemedText type="h3" style={styles.capacityValue}>
                  {warehouseContainer.currentAmount.toFixed(0)}
                </ThemedText>
                <ThemedText type="small" style={styles.fillLabel}>kg Used</ThemedText>
              </View>
              <View style={styles.fillStatDivider} />
              <View style={styles.fillStatItem}>
                <ThemedText type="h3" style={styles.capacityValue}>
                  {warehouseContainer.maxCapacity}
                </ThemedText>
                <ThemedText type="small" style={styles.fillLabel}>kg Max</ThemedText>
              </View>
            </View>

            <ProgressBar
              progress={fillPercentage / 100}
              color={getFillColor(fillPercentage)}
              style={styles.progressBar}
            />

            {fillPercentage >= 80 ? (
              <View style={styles.warningBanner}>
                <Feather name="alert-triangle" size={20} color={Colors.light.fillHigh} />
                <ThemedText type="body" style={styles.warningText}>
                  Container is almost full. Schedule emptying soon.
                </ThemedText>
              </View>
            ) : null}
          </Card>
        ) : (
          <Card style={styles.infoCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Customer Information
            </ThemedText>
            <View style={styles.infoRow}>
              <Feather name="building" size={20} color={Colors.light.textSecondary} />
              <View style={styles.infoContent}>
                <ThemedText type="small" style={styles.infoLabel}>Customer</ThemedText>
                <ThemedText type="body">{customerContainer.customerName}</ThemedText>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={20} color={Colors.light.textSecondary} />
              <View style={styles.infoContent}>
                <ThemedText type="small" style={styles.infoLabel}>Last Emptied</ThemedText>
                <ThemedText type="body">{formatDate(customerContainer.lastEmptied)}</ThemedText>
              </View>
            </View>

            {customerContainer.latitude && customerContainer.longitude ? (
              <Pressable style={styles.navButton} onPress={handleNavigation}>
                <Feather name="navigation" size={20} color={Colors.light.accent} />
                <ThemedText type="body" style={styles.navButtonText}>
                  Navigate to Location
                </ThemedText>
              </Pressable>
            ) : null}
          </Card>
        )}

        <Card style={styles.qrCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            QR Code
          </ThemedText>
          <View style={styles.qrContainer}>
            <View style={styles.qrPlaceholder}>
              <Feather name="maximize" size={48} color={Colors.light.textSecondary} />
            </View>
            <ThemedText type="small" style={styles.qrCode}>
              {container.qrCode}
            </ThemedText>
          </View>
        </Card>

        {isWarehouse && fillHistory.length > 0 ? (
          <Card style={styles.historyCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Recent Fill History
            </ThemedText>
            {fillHistory.slice(0, 5).map((entry) => (
              <View key={entry.id} style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={styles.historyContent}>
                  <ThemedText type="body">+{entry.amountAdded.toFixed(0)} kg</ThemedText>
                  <ThemedText type="small" style={styles.historyDate}>
                    {formatDate(entry.createdAt)}
                  </ThemedText>
                </View>
              </View>
            ))}
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
    marginBottom: Spacing.md,
  },
  containerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  containerId: {
    color: Colors.light.primary,
  },
  location: {
    color: Colors.light.textSecondary,
  },
  materialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
  materialText: {
    color: Colors.light.primary,
    fontWeight: "500",
  },
  fillCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  fillStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: Spacing.lg,
  },
  fillStatItem: {
    alignItems: "center",
  },
  fillStatDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
  },
  fillValue: {
    fontWeight: "700",
  },
  capacityValue: {
    color: Colors.light.text,
  },
  fillLabel: {
    color: Colors.light.textSecondary,
    marginTop: Spacing.xs,
  },
  progressBar: {
    height: 12,
    marginBottom: Spacing.md,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#FFEBEE",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  warningText: {
    color: Colors.light.fillHigh,
    flex: 1,
  },
  infoCard: {
    backgroundColor: Colors.light.backgroundDefault,
    gap: Spacing.md,
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
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: `${Colors.light.accent}15`,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  navButtonText: {
    color: Colors.light.accent,
    fontWeight: "600",
  },
  qrCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  qrContainer: {
    alignItems: "center",
    gap: Spacing.md,
  },
  qrPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  qrCode: {
    color: Colors.light.textSecondary,
    fontFamily: "monospace",
  },
  historyCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.fillLow,
    marginTop: 6,
  },
  historyContent: {
    flex: 1,
  },
  historyDate: {
    color: Colors.light.textSecondary,
  },
});
