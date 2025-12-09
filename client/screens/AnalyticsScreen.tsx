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
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, IndustrialDesign } from "@/constants/theme";

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

export default function AnalyticsScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const { data: analytics, isLoading, refetch, isRefetching } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics/fill-trends"],
  });

  const getFillColor = (percentage: number) => {
    if (percentage >= 80) return theme.fillHigh || theme.error;
    if (percentage >= 51) return theme.fillMedium || theme.warning;
    return theme.fillLow || theme.success;
  };

  const materialColors: Record<string, string> = {
    "Plastic": theme.statusInProgress,
    "Metal": theme.primary,
    "Paper": theme.warning,
    "Glass": theme.success,
    "Organic": theme.fillLow,
    "Electronic": theme.accent,
  };

  const getMaterialColor = (material: string) => {
    return materialColors[material] || theme.primary;
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
      </ThemedView>
    );
  }

  const maxDeliveries = Math.max(...(analytics?.dailyTrends || []).map(d => d.deliveries), 1);
  const chartHeight = 120;

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
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
            tintColor={theme.accent}
          />
        }
      >
        <Card style={{ backgroundColor: theme.cardSurface }}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.primary }]}>
            Wöchentliche Lieferungen
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
                        backgroundColor: day.deliveries > 0 ? theme.accent : theme.border,
                      },
                    ]}
                  />
                </View>
                <ThemedText type="small" style={[styles.barLabel, { color: theme.textSecondary }]}>
                  {day.date.split(" ")[1]}
                </ThemedText>
                <ThemedText type="small" style={[styles.barValue, { color: theme.text }]}>
                  {day.deliveries}
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>

        <Card style={{ backgroundColor: theme.cardSurface }}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.primary }]}>
            Materialverteilung
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
                    <ThemedText type="small" style={[styles.materialValue, { color: theme.textSecondary }]}>
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

        <Card style={{ backgroundColor: theme.cardSurface }}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.primary }]}>
            Container-Füllstände
          </ThemedText>
          <View style={styles.levelList}>
            {analytics?.containerLevels.map((container) => (
              <View key={container.id} style={styles.levelItem}>
                <View style={styles.levelHeader}>
                  <View style={styles.levelInfo}>
                    <ThemedText type="body" style={[styles.containerId, { color: theme.primary }]}>
                      {container.id}
                    </ThemedText>
                    <ThemedText type="small" style={[styles.containerLocation, { color: theme.textSecondary }]}>
                      {container.location}
                    </ThemedText>
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
                    <Feather name="tag" size={12} color={theme.textSecondary} />
                    <ThemedText type="small" style={[styles.levelMetaText, { color: theme.textSecondary }]}>
                      {container.materialType}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={[styles.levelMetaText, { color: theme.textSecondary }]}>
                    {container.currentAmount.toFixed(0)} / {container.maxCapacity} kg
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <Card style={{ backgroundColor: theme.cardSurface }}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.primary }]}>
            Zusammenfassung
          </ThemedText>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Feather name="truck" size={IndustrialDesign.iconSizeLarge} color={theme.accent} />
              <ThemedText type="h3" style={styles.summaryValue}>
                {analytics?.dailyTrends.reduce((sum, d) => sum + d.deliveries, 0) || 0}
              </ThemedText>
              <ThemedText type="small" style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Lieferungen gesamt
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <Feather name="package" size={IndustrialDesign.iconSizeLarge} color={theme.primary} />
              <ThemedText type="h3" style={styles.summaryValue}>
                {analytics?.containerLevels.length || 0}
              </ThemedText>
              <ThemedText type="small" style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Container
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <Feather name="alert-triangle" size={IndustrialDesign.iconSizeLarge} color={theme.error} />
              <ThemedText type="h3" style={styles.summaryValue}>
                {analytics?.containerLevels.filter(c => c.fillPercentage >= 80).length || 0}
              </ThemedText>
              <ThemedText type="small" style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Kritisch
              </ThemedText>
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
  chartCard: {},
  sectionTitle: {
    marginBottom: Spacing.lg,
    fontWeight: "700",
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
    fontSize: 10,
    fontWeight: "500",
  },
  barValue: {
    fontWeight: "700",
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
  materialValue: {},
  materialProgress: {
    height: 10,
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
    fontWeight: "700",
  },
  containerLocation: {},
  percentageBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  percentageText: {
    fontWeight: "700",
  },
  levelProgress: {
    height: 10,
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
  levelMetaText: {},
  summaryCard: {},
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  summaryValue: {},
  summaryLabel: {},
});
