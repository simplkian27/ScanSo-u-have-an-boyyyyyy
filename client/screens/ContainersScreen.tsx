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
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { ContainersStackParamList } from "@/navigation/ContainersStackNavigator";
import { CustomerContainer, WarehouseContainer } from "@shared/schema";

type NavigationProp = NativeStackNavigationProp<ContainersStackParamList, "Containers">;

type TabType = "customer" | "warehouse";

export default function ContainersScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
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
    if (!date) return "Nie";
    const d = new Date(date);
    return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
  };

  const getFillColor = (percentage: number) => {
    if (percentage >= 80) return theme.fillHigh;
    if (percentage >= 51) return theme.fillMedium;
    return theme.fillLow;
  };

  const renderCustomerContainer = ({ item }: { item: CustomerContainer }) => (
    <Card
      style={{ backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}
      onPress={() => navigation.navigate("ContainerDetail", { containerId: item.id, type: "customer" })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.containerInfo}>
          <Feather name="package" size={24} color={theme.primary} />
          <View>
            <ThemedText type="h4" style={{ color: theme.primary }}>{item.id}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>{item.customerName}</ThemedText>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Feather name="map-pin" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{item.location}</ThemedText>
        </View>
        <View style={styles.detailRow}>
          <Feather name="tag" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{item.materialType}</ThemedText>
        </View>
        <View style={styles.detailRow}>
          <Feather name="calendar" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Zuletzt geleert: {formatDate(item.lastEmptied)}
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
        style={{ backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}
        onPress={() => navigation.navigate("ContainerDetail", { containerId: item.id, type: "warehouse" })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.containerInfo}>
            <Feather name="package" size={24} color={theme.primary} />
            <View>
              <ThemedText type="h4" style={{ color: theme.primary }}>{item.id}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{item.location}</ThemedText>
            </View>
          </View>
          {isAlmostFull ? (
            <View style={[styles.warningBadge, { backgroundColor: theme.fillHigh }]}>
              <Feather name="alert-triangle" size={14} color="#FFFFFF" />
              <ThemedText type="small" style={styles.warningText}>Fast voll</ThemedText>
            </View>
          ) : (
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          )}
        </View>

        <View style={styles.fillContainer}>
          <View style={styles.fillHeader}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>{item.materialType}</ThemedText>
            <ThemedText type="body" style={[styles.fillPercentage, { color: fillColor }]}>
              {fillPercentage.toFixed(0)}%
            </ThemedText>
          </View>
          <ProgressBar
            progress={fillPercentage / 100}
            color={fillColor}
            style={styles.progressBar}
          />
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "right" }}>
            {item.currentAmount.toFixed(0)} / {item.maxCapacity} kg
          </ThemedText>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="package" size={48} color={theme.textSecondary} />
      <ThemedText type="h4" style={{ color: theme.text }}>
        Keine Container gefunden
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
        {activeTab === "customer"
          ? "Keine Kundencontainer verfügbar"
          : "Keine Lagercontainer verfügbar"}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.tabContainer, { marginTop: headerHeight, backgroundColor: theme.backgroundDefault }]}>
        <Pressable
          style={[styles.tab, activeTab === "customer" && { ...styles.activeTab, backgroundColor: theme.backgroundRoot }]}
          onPress={() => setActiveTab("customer")}
        >
          <Feather
            name="users"
            size={18}
            color={activeTab === "customer" ? theme.accent : theme.textSecondary}
          />
          <ThemedText
            type="body"
            style={{
              color: activeTab === "customer" ? theme.accent : theme.textSecondary,
              fontWeight: activeTab === "customer" ? "600" : "500",
            }}
          >
            Kunde
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "warehouse" && { ...styles.activeTab, backgroundColor: theme.backgroundRoot }]}
          onPress={() => setActiveTab("warehouse")}
        >
          <Feather
            name="home"
            size={18}
            color={activeTab === "warehouse" ? theme.accent : theme.textSecondary}
          />
          <ThemedText
            type="body"
            style={{
              color: activeTab === "warehouse" ? theme.accent : theme.textSecondary,
              fontWeight: activeTab === "warehouse" ? "600" : "500",
            }}
          >
            Lager
          </ThemedText>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={activeTab === "customer" ? customerContainers : warehouseContainers}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === "customer" ? renderCustomerContainer : renderWarehouseContainer}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl, backgroundColor: theme.backgroundRoot },
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
  tabContainer: {
    flexDirection: "row",
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
    borderRadius: BorderRadius.xs,
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
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
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
  fillContainer: {
    gap: Spacing.sm,
  },
  fillHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fillPercentage: {
    fontWeight: "700",
  },
  progressBar: {
    height: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
});
