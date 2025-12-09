import React from "react";
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Dimensions } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface DailyTrend {
  date: string;
  deliveries: number;
  volumeKg: number;
}

interface ContainerLevel {
  id: string;
  location: string;
  materialType: string;
  currentAmount: number;
  maxCapacity: number;
  fillPercentage: number;
}

interface MaterialBreakdown {
  material: string;
  currentAmount: number;
  maxCapacity: number;
}

interface AnalyticsData {
  dailyTrends: DailyTrend[];
  containerLevels: ContainerLevel[];
  materialBreakdown: MaterialBreakdown[];
}

const { width: screenWidth } = Dimensions.get("window");

export default function AnalyticsScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const { data: analytics, isLoading, refetch, isRefetching } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics/fill-trends"],
  });

  const getFillColor = (percentage: number) => {
    if (percentage >= 80) return Colors.light.fillHigh;
    if (percentage >= 51) return Colors.light.fillMedium;
    return Colors.light.fillLow;
  };

  const materialColors: Record<string, string> = {
    "Plastic": "#3B82F6",
    "Metal": "#6B7280",
    "Paper": "#F59E0B",
    "Glass": "#10B981",
    "Organic": "#84CC16",
    "Electronic": "#8B5CF6",
  };

  const getMaterialColor = (material: string) => {
    return materialColors[material] || Colors.light.primary;
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
      </ThemedView>
    );
  }

  const maxDeliveries = Math.max(...(analytics?.dailyTrends || []).map(d => d.deliveries), 1);
  const chartHeight = 120;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.light.accent}
          />
        }
      >
        <Card style={styles.chartCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Weekly Deliveries
          </ThemedText>
          <View style={styles.barChart}>
            {analytics?.dailyTrends.map((day, index) => (
              <View key={day.date} style={styles.barContainer}>
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max((day.deliveries / maxDeliveries) * chartHeight, 4),
                        backgroundColor: day.deliveries > 0 ? Colors.light.accent : Colors.light.border,
                      },
                    ]}
                  />
                </View>
                <ThemedText type="small" style={styles.barLabel}>
                  {day.date.split(" ")[1]}
                </ThemedText>
                <ThemedText type="small" style={styles.barValue}>
                  {day.deliveries}
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.chartCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Material Distribution
          </ThemedText>
          <View style={styles.materialList}>
            {analytics?.materialBreakdown.map((material) => {
              const percentage = Math.round((material.currentAmount / material.maxCapacity) * 100);
              return (
                <View key={material.material} style={styles.materialItem}>
                  <View style={styles.materialHeader}>
                    <View style={styles.materialLabel}>
                      <View style={[styles.materialDot, { backgroundColor: getMaterialColor(material.material) }]} />
                      <ThemedText type="body">{material.material}</ThemedText>
                    </View>
                    <ThemedText type="small" style={styles.materialValue}>
                      {material.currentAmount.toFixed(0)} / {material.maxCapacity.toFixed(0)} kg
                    </ThemedText>
                  </View>
                  <ProgressBar
                    progress={percentage / 100}
                    color={getMaterialColor(material.material)}
                    style={styles.materialProgress}
                  />
                </View>
              );
            })}
          </View>
        </Card>

        <Card style={styles.chartCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Container Fill Levels
          </ThemedText>
          <View style={styles.levelList}>
            {analytics?.containerLevels.map((container) => (
              <View key={container.id} style={styles.levelItem}>
                <View style={styles.levelHeader}>
                  <View style={styles.levelInfo}>
                    <ThemedText type="body" style={styles.containerId}>{container.id}</ThemedText>
                    <ThemedText type="small" style={styles.containerLocation}>{container.location}</ThemedText>
                  </View>
                  <View style={[styles.percentageBadge, { backgroundColor: `${getFillColor(container.fillPercentage)}20` }]}>
                    <ThemedText type="body" style={[styles.percentageText, { color: getFillColor(container.fillPercentage) }]}>
                      {container.fillPercentage}%
                    </ThemedText>
                  </View>
                </View>
                <ProgressBar
                  progress={container.fillPercentage / 100}
                  color={getFillColor(container.fillPercentage)}
                  style={styles.levelProgress}
                />
                <View style={styles.levelMeta}>
                  <View style={styles.levelMetaItem}>
                    <Feather name="tag" size={12} color={Colors.light.textSecondary} />
                    <ThemedText type="small" style={styles.levelMetaText}>{container.materialType}</ThemedText>
                  </View>
                  <ThemedText type="small" style={styles.levelMetaText}>
                    {container.currentAmount.toFixed(0)} / {container.maxCapacity} kg
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.summaryCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Summary
          </ThemedText>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Feather name="truck" size={24} color={Colors.light.accent} />
              <ThemedText type="h3" style={styles.summaryValue}>
                {analytics?.dailyTrends.reduce((sum, d) => sum + d.deliveries, 0) || 0}
              </ThemedText>
              <ThemedText type="small" style={styles.summaryLabel}>Total Deliveries</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <Feather name="package" size={24} color={Colors.light.primary} />
              <ThemedText type="h3" style={styles.summaryValue}>
                {analytics?.containerLevels.length || 0}
              </ThemedText>
              <ThemedText type="small" style={styles.summaryLabel}>Containers</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <Feather name="alert-triangle" size={24} color={Colors.light.fillHigh} />
              <ThemedText type="h3" style={styles.summaryValue}>
                {analytics?.containerLevels.filter(c => c.fillPercentage >= 80).length || 0}
              </ThemedText>
              <ThemedText type="small" style={styles.summaryLabel}>Critical</ThemedText>
            </View>
          </View>
        </Card>
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
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  chartCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  barChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 160,
    paddingTop: Spacing.md,
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  barWrapper: {
    flex: 1,
    justifyContent: "flex-end",
    width: "100%",
    paddingHorizontal: 4,
  },
  bar: {
    borderRadius: BorderRadius.xs,
    minHeight: 4,
  },
  barLabel: {
    color: Colors.light.textSecondary,
    fontSize: 10,
  },
  barValue: {
    color: Colors.light.text,
    fontWeight: "600",
    fontSize: 10,
  },
  materialList: {
    gap: Spacing.md,
  },
  materialItem: {
    gap: Spacing.sm,
  },
  materialHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  materialLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  materialDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  materialValue: {
    color: Colors.light.textSecondary,
  },
  materialProgress: {
    height: 8,
  },
  levelList: {
    gap: Spacing.lg,
  },
  levelItem: {
    gap: Spacing.sm,
  },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelInfo: {
    flex: 1,
  },
  containerId: {
    color: Colors.light.primary,
    fontWeight: "600",
  },
  containerLocation: {
    color: Colors.light.textSecondary,
  },
  percentageBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  percentageText: {
    fontWeight: "700",
  },
  levelProgress: {
    height: 8,
  },
  levelMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  levelMetaText: {
    color: Colors.light.textSecondary,
  },
  summaryCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  summaryValue: {
    color: Colors.light.text,
  },
  summaryLabel: {
    color: Colors.light.textSecondary,
  },
});
