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
import { ProgressBar } from "@/components/ProgressBar";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { ContainersStackParamList } from "@/navigation/ContainersStackNavigator";
import { CustomerContainer, WarehouseContainer } from "@shared/schema";

type NavigationProp = NativeStackNavigationProp<ContainersStackParamList, "Containers">;

type TabType = "customer" | "warehouse";

export default function ContainersScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState<TabType>("customer");

  const { data: customerContainers = [], isLoading: loadingCustomer, refetch: refetchCustomer, isRefetching: refetchingCustomer } = useQuery<CustomerContainer[]>({
    queryKey: ["/api/containers/customer"],
  });

  const { data: warehouseContainers = [], isLoading: loadingWarehouse, refetch: refetchWarehouse, isRefetching: refetchingWarehouse } = useQuery<WarehouseContainer[]>({
    queryKey: ["/api/containers/warehouse"],
  });

  const isLoading = activeTab === "customer" ? loadingCustomer : loadingWarehouse;
  const isRefetching = activeTab === "customer" ? refetchingCustomer : refetchingWarehouse;
  const refetch = activeTab === "customer" ? refetchCustomer : refetchWarehouse;

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getFillColor = (percentage: number) => {
    if (percentage >= 80) return Colors.light.fillHigh;
    if (percentage >= 51) return Colors.light.fillMedium;
    return Colors.light.fillLow;
  };

  const renderCustomerContainer = ({ item }: { item: CustomerContainer }) => (
    <Card
      style={styles.containerCard}
      onPress={() => navigation.navigate("ContainerDetail", { containerId: item.id, type: "customer" })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.containerInfo}>
          <Feather name="package" size={24} color={Colors.light.primary} />
          <View>
            <ThemedText type="h4" style={styles.containerId}>{item.id}</ThemedText>
            <ThemedText type="small" style={styles.customerName}>{item.customerName}</ThemedText>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={Colors.light.textSecondary} />
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Feather name="map-pin" size={16} color={Colors.light.textSecondary} />
          <ThemedText type="small" style={styles.detailText}>{item.location}</ThemedText>
        </View>
        <View style={styles.detailRow}>
          <Feather name="tag" size={16} color={Colors.light.textSecondary} />
          <ThemedText type="small" style={styles.detailText}>{item.materialType}</ThemedText>
        </View>
        <View style={styles.detailRow}>
          <Feather name="calendar" size={16} color={Colors.light.textSecondary} />
          <ThemedText type="small" style={styles.detailText}>
            Last emptied: {formatDate(item.lastEmptied)}
          </ThemedText>
        </View>
      </View>
    </Card>
  );

  const renderWarehouseContainer = ({ item }: { item: WarehouseContainer }) => {
    const fillPercentage = (item.currentAmount / item.maxCapacity) * 100;
    const fillColor = getFillColor(fillPercentage);
    const isAlmostFull = fillPercentage >= 80;

    return (
      <Card
        style={styles.containerCard}
        onPress={() => navigation.navigate("ContainerDetail", { containerId: item.id, type: "warehouse" })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.containerInfo}>
            <Feather name="package" size={24} color={Colors.light.primary} />
            <View>
              <ThemedText type="h4" style={styles.containerId}>{item.id}</ThemedText>
              <ThemedText type="small" style={styles.customerName}>{item.location}</ThemedText>
            </View>
          </View>
          {isAlmostFull ? (
            <View style={styles.warningBadge}>
              <Feather name="alert-triangle" size={14} color="#FFFFFF" />
              <ThemedText type="small" style={styles.warningText}>Almost Full</ThemedText>
            </View>
          ) : (
            <Feather name="chevron-right" size={20} color={Colors.light.textSecondary} />
          )}
        </View>

        <View style={styles.fillContainer}>
          <View style={styles.fillHeader}>
            <ThemedText type="small" style={styles.materialType}>{item.materialType}</ThemedText>
            <ThemedText type="body" style={[styles.fillPercentage, { color: fillColor }]}>
              {fillPercentage.toFixed(0)}%
            </ThemedText>
          </View>
          <ProgressBar
            progress={fillPercentage / 100}
            color={fillColor}
            style={styles.progressBar}
          />
          <ThemedText type="small" style={styles.capacityText}>
            {item.currentAmount.toFixed(0)} / {item.maxCapacity} kg
          </ThemedText>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="package" size={48} color={Colors.light.textSecondary} />
      <ThemedText type="h4" style={styles.emptyTitle}>
        No containers found
      </ThemedText>
      <ThemedText type="body" style={styles.emptySubtitle}>
        {activeTab === "customer"
          ? "No customer containers available"
          : "No warehouse containers available"}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.tabContainer, { marginTop: headerHeight }]}>
        <Pressable
          style={[styles.tab, activeTab === "customer" && styles.activeTab]}
          onPress={() => setActiveTab("customer")}
        >
          <Feather
            name="users"
            size={18}
            color={activeTab === "customer" ? Colors.light.accent : Colors.light.textSecondary}
          />
          <ThemedText
            type="body"
            style={[styles.tabText, activeTab === "customer" && styles.activeTabText]}
          >
            Customer
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "warehouse" && styles.activeTab]}
          onPress={() => setActiveTab("warehouse")}
        >
          <Feather
            name="home"
            size={18}
            color={activeTab === "warehouse" ? Colors.light.accent : Colors.light.textSecondary}
          />
          <ThemedText
            type="body"
            style={[styles.tabText, activeTab === "warehouse" && styles.activeTabText]}
          >
            Warehouse
          </ThemedText>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
        </View>
      ) : (
        <FlatList
          data={activeTab === "customer" ? customerContainers : warehouseContainers}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === "customer" ? renderCustomerContainer : renderWarehouseContainer}
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
  tabContainer: {
    flexDirection: "row",
    backgroundColor: Colors.light.backgroundDefault,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  activeTab: {
    backgroundColor: Colors.light.backgroundRoot,
  },
  tabText: {
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  activeTabText: {
    color: Colors.light.accent,
    fontWeight: "600",
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
  customerName: {
    color: Colors.light.textSecondary,
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.light.fillHigh,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  warningText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 11,
  },
  cardDetails: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  detailText: {
    color: Colors.light.textSecondary,
  },
  fillContainer: {
    gap: Spacing.sm,
  },
  fillHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  materialType: {
    color: Colors.light.textSecondary,
  },
  fillPercentage: {
    fontWeight: "700",
  },
  progressBar: {
    height: 10,
  },
  capacityText: {
    color: Colors.light.textSecondary,
    textAlign: "right",
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
