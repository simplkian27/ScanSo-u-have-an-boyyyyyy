import React from "react";
import { View, StyleSheet, FlatList, RefreshControl, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { WarehouseContainer } from "@shared/schema";

export default function WarehouseScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const { data: containers = [], isLoading, refetch, isRefetching } = useQuery<WarehouseContainer[]>({
    queryKey: ["/api/containers/warehouse"],
  });

  const getFillPercentage = (container: WarehouseContainer) => {
    if (container.maxCapacity <= 0) return 0;
    return Math.round((container.currentAmount / container.maxCapacity) * 100);
  };

  const getFillStatus = (percentage: number): "success" | "warning" | "critical" => {
    if (percentage >= 90) return "critical";
    if (percentage >= 70) return "warning";
    return "success";
  };

  const getFillColor = (percentage: number) => {
    if (percentage >= 90) return theme.error;
    if (percentage >= 70) return theme.warning;
    return theme.success;
  };

  const renderContainer = ({ item }: { item: WarehouseContainer }) => {
    const fillPercentage = getFillPercentage(item);
    const fillColor = getFillColor(fillPercentage);

    return (
      <Card style={{ backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}>
        <View style={styles.containerRow}>
          <View style={[styles.fillIndicator, { backgroundColor: fillColor }]} />
          <View style={styles.containerContent}>
            <View style={styles.containerHeader}>
              <View style={styles.containerTitleRow}>
                <Feather name="archive" size={20} color={theme.primary} />
                <ThemedText type="bodyBold" style={{ color: theme.text, marginLeft: Spacing.sm }}>
                  {item.materialType}
                </ThemedText>
              </View>
              <StatusBadge 
                status={getFillStatus(fillPercentage)} 
                size="small"
                label={`${fillPercentage}%`}
              />
            </View>

            <View style={styles.containerDetails}>
              <View style={styles.detailRow}>
                <Feather name="map-pin" size={14} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                  {item.location}
                </ThemedText>
              </View>
              {item.warehouseZone ? (
                <View style={styles.detailRow}>
                  <Feather name="grid" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                    Zone: {item.warehouseZone}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <View style={styles.capacitySection}>
              <View style={[styles.capacityBar, { backgroundColor: theme.backgroundSecondary }]}>
                <View 
                  style={[
                    styles.capacityFill, 
                    { 
                      backgroundColor: fillColor,
                      width: `${Math.min(fillPercentage, 100)}%`,
                    }
                  ]} 
                />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {item.currentAmount.toFixed(0)} / {item.maxCapacity} {item.quantityUnit}
              </ThemedText>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <EmptyState
      icon="archive"
      title="Keine Lagercontainer"
      message="Es wurden noch keine Lagercontainer angelegt."
    />
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {isLoading ? (
        <LoadingScreen fullScreen={false} message="Lagercontainer werden geladen..." />
      ) : (
        <FlatList
          data={containers}
          keyExtractor={(item) => item.id}
          renderItem={renderContainer}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
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
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  containerRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  fillIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  containerContent: {
    flex: 1,
    gap: Spacing.sm,
  },
  containerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  containerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  containerDetails: {
    gap: Spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  capacitySection: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  capacityBar: {
    height: 8,
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
  },
  capacityFill: {
    height: "100%",
    borderRadius: BorderRadius.xs,
  },
});
