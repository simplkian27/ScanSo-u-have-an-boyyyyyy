import React, { useState } from "react";
import { View, StyleSheet, FlatList, Modal, ActivityIndicator, Pressable, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { ProgressBar } from "@/components/ProgressBar";
import { FilterChip } from "@/components/FilterChip";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { CustomerContainer, WarehouseContainer } from "@shared/schema";

type ContainerType = "customer" | "warehouse";

export default function ManageContainersScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ContainerType>("warehouse");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<WarehouseContainer | null>(null);

  const { data: customerContainers = [], isLoading: loadingCustomer } = useQuery<CustomerContainer[]>({
    queryKey: ["/api/containers/customer"],
  });

  const { data: warehouseContainers = [], isLoading: loadingWarehouse } = useQuery<WarehouseContainer[]>({
    queryKey: ["/api/containers/warehouse"],
  });

  const isLoading = activeTab === "customer" ? loadingCustomer : loadingWarehouse;

  const resetFillLevel = async (container: WarehouseContainer) => {
    try {
      await apiRequest("PATCH", `/api/containers/warehouse/${container.id}`, {
        currentAmount: 0,
        lastEmptied: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/warehouse"] });
      setSelectedContainer(null);
    } catch (err) {
      console.error("Failed to reset fill level:", err);
    }
  };

  const getFillColor = (percentage: number) => {
    if (percentage >= 80) return Colors.light.fillHigh;
    if (percentage >= 51) return Colors.light.fillMedium;
    return Colors.light.fillLow;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const renderWarehouseContainer = ({ item }: { item: WarehouseContainer }) => {
    const fillPercentage = (item.currentAmount / item.maxCapacity) * 100;
    const fillColor = getFillColor(fillPercentage);

    return (
      <Card style={styles.containerCard} onPress={() => setSelectedContainer(item)}>
        <View style={styles.cardHeader}>
          <View style={styles.containerInfo}>
            <Feather name="package" size={24} color={Colors.light.primary} />
            <View>
              <ThemedText type="h4" style={styles.containerId}>{item.id}</ThemedText>
              <ThemedText type="small" style={styles.location}>{item.location}</ThemedText>
            </View>
          </View>
          <Feather name="edit-2" size={18} color={Colors.light.textSecondary} />
        </View>

        <View style={styles.fillInfo}>
          <View style={styles.fillHeader}>
            <ThemedText type="small" style={styles.materialType}>{item.materialType}</ThemedText>
            <ThemedText type="body" style={[styles.fillPercentage, { color: fillColor }]}>
              {fillPercentage.toFixed(0)}%
            </ThemedText>
          </View>
          <ProgressBar progress={fillPercentage / 100} color={fillColor} />
          <ThemedText type="small" style={styles.capacityText}>
            {item.currentAmount.toFixed(0)} / {item.maxCapacity} kg
          </ThemedText>
        </View>
      </Card>
    );
  };

  const renderCustomerContainer = ({ item }: { item: CustomerContainer }) => (
    <Card style={styles.containerCard}>
      <View style={styles.cardHeader}>
        <View style={styles.containerInfo}>
          <Feather name="package" size={24} color={Colors.light.primary} />
          <View>
            <ThemedText type="h4" style={styles.containerId}>{item.id}</ThemedText>
            <ThemedText type="small" style={styles.location}>{item.customerName}</ThemedText>
          </View>
        </View>
      </View>
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Feather name="map-pin" size={14} color={Colors.light.textSecondary} />
          <ThemedText type="small" style={styles.detailText}>{item.location}</ThemedText>
        </View>
        <View style={styles.detailItem}>
          <Feather name="tag" size={14} color={Colors.light.textSecondary} />
          <ThemedText type="small" style={styles.detailText}>{item.materialType}</ThemedText>
        </View>
      </View>
      <ThemedText type="small" style={styles.lastEmptied}>
        Last emptied: {formatDate(item.lastEmptied)}
      </ThemedText>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="package" size={48} color={Colors.light.textSecondary} />
      <ThemedText type="h4">No containers</ThemedText>
      <ThemedText type="body" style={styles.emptySubtitle}>
        No {activeTab} containers found
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.tabContainer, { marginTop: headerHeight }]}>
        <FilterChip
          label="Warehouse"
          selected={activeTab === "warehouse"}
          onPress={() => setActiveTab("warehouse")}
        />
        <FilterChip
          label="Customer"
          selected={activeTab === "customer"}
          onPress={() => setActiveTab("customer")}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
        </View>
      ) : (
        <FlatList
          data={activeTab === "warehouse" ? warehouseContainers : customerContainers}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === "warehouse" ? renderWarehouseContainer : renderCustomerContainer}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl },
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={!!selectedContainer}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedContainer(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Container Details</ThemedText>
              <Pressable
                onPress={() => setSelectedContainer(null)}
                style={styles.closeButton}
              >
                <Feather name="x" size={24} color={Colors.light.text} />
              </Pressable>
            </View>

            {selectedContainer ? (
              <>
                <Card style={styles.detailCard}>
                  <View style={styles.containerInfo}>
                    <Feather name="package" size={32} color={Colors.light.primary} />
                    <View>
                      <ThemedText type="h4">{selectedContainer.id}</ThemedText>
                      <ThemedText type="small" style={styles.location}>
                        {selectedContainer.location}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.detailsList}>
                    <View style={styles.detailRow}>
                      <ThemedText type="small" style={styles.detailLabel}>Material</ThemedText>
                      <ThemedText type="body">{selectedContainer.materialType}</ThemedText>
                    </View>
                    <View style={styles.detailRow}>
                      <ThemedText type="small" style={styles.detailLabel}>Current Fill</ThemedText>
                      <ThemedText type="body">
                        {selectedContainer.currentAmount.toFixed(0)} / {selectedContainer.maxCapacity} kg
                      </ThemedText>
                    </View>
                    <View style={styles.detailRow}>
                      <ThemedText type="small" style={styles.detailLabel}>Last Emptied</ThemedText>
                      <ThemedText type="body">{formatDate(selectedContainer.lastEmptied)}</ThemedText>
                    </View>
                  </View>
                </Card>

                <Button
                  style={styles.resetButton}
                  onPress={() => resetFillLevel(selectedContainer)}
                >
                  <View style={styles.resetContent}>
                    <Feather name="refresh-ccw" size={20} color="#FFFFFF" />
                    <ThemedText type="body" style={styles.resetText}>
                      Reset Fill Level to 0
                    </ThemedText>
                  </View>
                </Button>

                <ThemedText type="small" style={styles.resetHint}>
                  This will mark the container as emptied and reset the fill level to 0 kg.
                </ThemedText>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundRoot,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundDefault,
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
  containerCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  fillInfo: {
    gap: Spacing.sm,
  },
  fillHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  materialType: {
    color: Colors.light.textSecondary,
  },
  fillPercentage: {
    fontWeight: "700",
  },
  capacityText: {
    color: Colors.light.textSecondary,
    textAlign: "right",
  },
  detailsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  detailText: {
    color: Colors.light.textSecondary,
  },
  lastEmptied: {
    color: Colors.light.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptySubtitle: {
    color: Colors.light.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.light.backgroundRoot,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  detailCard: {
    backgroundColor: Colors.light.backgroundDefault,
    marginBottom: Spacing.lg,
  },
  detailsList: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    color: Colors.light.textSecondary,
  },
  resetButton: {
    backgroundColor: Colors.light.accent,
  },
  resetContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  resetText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  resetHint: {
    textAlign: "center",
    color: Colors.light.textSecondary,
    marginTop: Spacing.md,
  },
});
