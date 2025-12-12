import React, { useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { FilterChip } from "@/components/FilterChip";
import { ProgressBar } from "@/components/ProgressBar";
import { LoadingScreen } from "@/components/LoadingScreen";
import { EmptyState } from "@/components/EmptyState";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AUTOMOTIVE_TASK_STATUS_LABELS } from "@shared/schema";

type DateRangeKey = "today" | "7days" | "30days" | "90days";

interface MaterialData {
  materialId: string | null;
  materialName: string | null;
  totalWeightKg: string | null;
  taskCount: number;
}

interface StationData {
  stationId: string;
  stationName: string;
  stationCode: string | null;
  materialId: string | null;
  materialName: string | null;
  totalWeightKg: string | null;
  taskCount: number;
}

interface LeadTimesData {
  avgOpenToPickedUpHours: string | null;
  avgPickedUpToDroppedOffHours: string | null;
  avgDroppedOffToDisposedHours: string | null;
  taskCount: number;
}

interface BacklogTask {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  stationName: string | null;
  materialName: string | null;
}

interface BacklogSummary {
  status: string;
  count: number;
}

interface BacklogResponse {
  olderThanHours: number;
  summary: BacklogSummary[];
  data: Record<string, BacklogTask[]>;
}

const DATE_RANGES: { key: DateRangeKey; label: string; days: number }[] = [
  { key: "today", label: "Heute", days: 0 },
  { key: "7days", label: "7 Tage", days: 7 },
  { key: "30days", label: "30 Tage", days: 30 },
  { key: "90days", label: "90 Tage", days: 90 },
];

function getDateRange(key: DateRangeKey): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  
  const range = DATE_RANGES.find(r => r.key === key);
  const days = range?.days ?? 7;
  
  if (days === 0) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    return { from: startOfDay.toISOString(), to };
  }
  
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to };
}

export default function AnalyticsScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const [dateRange, setDateRange] = useState<DateRangeKey>("7days");
  const [materialSortAsc, setMaterialSortAsc] = useState(false);

  const { from, to } = useMemo(() => getDateRange(dateRange), [dateRange]);

  const { 
    data: materialsResponse, 
    isLoading: materialsLoading,
    refetch: refetchMaterials,
    isRefetching: materialsRefetching,
  } = useQuery<{ data: MaterialData[]; groupBy: string }>({
    queryKey: ["/api/analytics/materials", { from, to }],
  });

  const { 
    data: stationsResponse, 
    isLoading: stationsLoading,
    refetch: refetchStations,
    isRefetching: stationsRefetching,
  } = useQuery<{ data: StationData[] }>({
    queryKey: ["/api/analytics/stations", { from, to }],
  });

  const { 
    data: leadTimesResponse, 
    isLoading: leadTimesLoading,
    refetch: refetchLeadTimes,
    isRefetching: leadTimesRefetching,
  } = useQuery<{ data: LeadTimesData | null; by: string }>({
    queryKey: ["/api/analytics/lead-times", { from, to, by: "overall" }],
  });

  const { 
    data: backlogResponse, 
    isLoading: backlogLoading,
    refetch: refetchBacklog,
    isRefetching: backlogRefetching,
  } = useQuery<BacklogResponse>({
    queryKey: ["/api/analytics/backlog"],
  });

  const isLoading = materialsLoading || stationsLoading || leadTimesLoading || backlogLoading;
  const isRefetching = materialsRefetching || stationsRefetching || leadTimesRefetching || backlogRefetching;

  const handleRefresh = () => {
    refetchMaterials();
    refetchStations();
    refetchLeadTimes();
    refetchBacklog();
  };

  const materials = materialsResponse?.data ?? [];
  const stations = stationsResponse?.data ?? [];
  const leadTimes = leadTimesResponse?.data;
  const backlog = backlogResponse;

  const sortedMaterials = useMemo(() => {
    const sorted = [...materials].sort((a, b) => {
      const aWeight = parseFloat(a.totalWeightKg || "0");
      const bWeight = parseFloat(b.totalWeightKg || "0");
      return materialSortAsc ? aWeight - bWeight : bWeight - aWeight;
    });
    return sorted;
  }, [materials, materialSortAsc]);

  const totalKg = useMemo(() => {
    return materials.reduce((sum, m) => sum + parseFloat(m.totalWeightKg || "0"), 0);
  }, [materials]);

  const topMaterial = useMemo(() => {
    if (materials.length === 0) return null;
    return [...materials].sort((a, b) => 
      parseFloat(b.totalWeightKg || "0") - parseFloat(a.totalWeightKg || "0")
    )[0];
  }, [materials]);

  const topStation = useMemo(() => {
    if (stations.length === 0) return null;
    const stationTotals: Record<string, { name: string; total: number }> = {};
    for (const s of stations) {
      if (!stationTotals[s.stationId]) {
        stationTotals[s.stationId] = { name: s.stationName, total: 0 };
      }
      stationTotals[s.stationId].total += parseFloat(s.totalWeightKg || "0");
    }
    const sorted = Object.values(stationTotals).sort((a, b) => b.total - a.total);
    return sorted[0] || null;
  }, [stations]);

  const openTasksCount = useMemo(() => {
    if (!backlog?.summary) return 0;
    return backlog.summary.reduce((sum, s) => sum + s.count, 0);
  }, [backlog]);

  const formatNumber = (num: number) => {
    return num.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  };

  const formatHours = (hours: string | null) => {
    if (!hours) return "-";
    const num = parseFloat(hours);
    if (isNaN(num)) return "-";
    if (num < 1) return `${Math.round(num * 60)} min`;
    return `${formatNumber(num)} h`;
  };

  const getMaxLeadTime = () => {
    if (!leadTimes) return 24;
    const values = [
      parseFloat(leadTimes.avgOpenToPickedUpHours || "0"),
      parseFloat(leadTimes.avgPickedUpToDroppedOffHours || "0"),
      parseFloat(leadTimes.avgDroppedOffToDisposedHours || "0"),
    ];
    return Math.max(...values, 1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN": return theme.statusOpen;
      case "PICKED_UP":
      case "IN_TRANSIT": return theme.warning;
      case "DROPPED_OFF":
      case "TAKEN_OVER":
      case "WEIGHED": return theme.info;
      default: return theme.textSecondary;
    }
  };

  if (isLoading) {
    return <LoadingScreen fullScreen message="Statistiken werden geladen..." />;
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
          />
        }
      >
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateFilters}
        >
          {DATE_RANGES.map((range) => (
            <FilterChip
              key={range.key}
              label={range.label}
              selected={dateRange === range.key}
              onPress={() => setDateRange(range.key)}
              small
            />
          ))}
        </ScrollView>

        <View style={styles.kpiGrid}>
          <Card style={{ ...styles.kpiCard, backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}>
            <View style={styles.kpiContent}>
              <View style={[styles.kpiIconContainer, { backgroundColor: theme.accent + "20" }]}>
                <Feather name="trending-up" size={20} color={theme.accent} />
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Gesamt kg
              </ThemedText>
              <ThemedText type="h4" style={{ color: theme.text }}>
                {formatNumber(totalKg)}
              </ThemedText>
            </View>
          </Card>

          <Card style={{ ...styles.kpiCard, backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}>
            <View style={styles.kpiContent}>
              <View style={[styles.kpiIconContainer, { backgroundColor: theme.success + "20" }]}>
                <Feather name="package" size={20} color={theme.success} />
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Top Material
              </ThemedText>
              <ThemedText type="bodyBold" style={{ color: theme.text }} numberOfLines={1}>
                {topMaterial?.materialName || "-"}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {topMaterial ? `${formatNumber(parseFloat(topMaterial.totalWeightKg || "0"))} kg` : "-"}
              </ThemedText>
            </View>
          </Card>

          <Card style={{ ...styles.kpiCard, backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}>
            <View style={styles.kpiContent}>
              <View style={[styles.kpiIconContainer, { backgroundColor: theme.info + "20" }]}>
                <Feather name="map-pin" size={20} color={theme.info} />
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Top Station
              </ThemedText>
              <ThemedText type="bodyBold" style={{ color: theme.text }} numberOfLines={1}>
                {topStation?.name || "-"}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {topStation ? `${formatNumber(topStation.total)} kg` : "-"}
              </ThemedText>
            </View>
          </Card>

          <Card style={{ ...styles.kpiCard, backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}>
            <View style={styles.kpiContent}>
              <View style={[styles.kpiIconContainer, { backgroundColor: theme.warning + "20" }]}>
                <Feather name="clock" size={20} color={theme.warning} />
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Offene Tasks
              </ThemedText>
              <ThemedText type="h4" style={{ color: openTasksCount > 0 ? theme.warning : theme.text }}>
                {openTasksCount}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {">"} 24h
              </ThemedText>
            </View>
          </Card>
        </View>

        <Card style={{ ...styles.sectionCard, backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4" style={{ color: theme.text }}>
              Material-Übersicht
            </ThemedText>
            <Pressable 
              onPress={() => setMaterialSortAsc(!materialSortAsc)}
              style={styles.sortButton}
            >
              <Feather 
                name={materialSortAsc ? "arrow-up" : "arrow-down"} 
                size={16} 
                color={theme.textSecondary} 
              />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                Gewicht
              </ThemedText>
            </Pressable>
          </View>

          <View style={[styles.tableHeader, { borderBottomColor: theme.divider }]}>
            <ThemedText type="captionBold" style={[styles.tableHeaderCell, styles.cellMaterial, { color: theme.textSecondary }]}>
              Material
            </ThemedText>
            <ThemedText type="captionBold" style={[styles.tableHeaderCell, styles.cellCount, { color: theme.textSecondary }]}>
              Anzahl
            </ThemedText>
            <ThemedText type="captionBold" style={[styles.tableHeaderCell, styles.cellWeight, { color: theme.textSecondary }]}>
              Gewicht (kg)
            </ThemedText>
          </View>

          {sortedMaterials.length === 0 ? (
            <View style={styles.emptyRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Keine Daten im Zeitraum
              </ThemedText>
            </View>
          ) : (
            sortedMaterials.map((material, index) => (
              <View 
                key={material.materialId || index} 
                style={[
                  styles.tableRow, 
                  index < sortedMaterials.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.divider }
                ]}
              >
                <ThemedText type="small" style={[styles.cellMaterial, { color: theme.text }]} numberOfLines={1}>
                  {material.materialName || "Unbekannt"}
                </ThemedText>
                <ThemedText type="small" style={[styles.cellCount, { color: theme.textSecondary }]}>
                  {material.taskCount}
                </ThemedText>
                <ThemedText type="smallBold" style={[styles.cellWeight, { color: theme.text }]}>
                  {formatNumber(parseFloat(material.totalWeightKg || "0"))}
                </ThemedText>
              </View>
            ))
          )}
        </Card>

        <Card style={{ ...styles.sectionCard, backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}>
          <ThemedText type="h4" style={{ color: theme.text, marginBottom: Spacing.md }}>
            Stations-Übersicht
          </ThemedText>

          <View style={[styles.tableHeader, { borderBottomColor: theme.divider }]}>
            <ThemedText type="captionBold" style={[styles.tableHeaderCell, styles.cellStation, { color: theme.textSecondary }]}>
              Station
            </ThemedText>
            <ThemedText type="captionBold" style={[styles.tableHeaderCell, styles.cellMaterialSmall, { color: theme.textSecondary }]}>
              Material
            </ThemedText>
            <ThemedText type="captionBold" style={[styles.tableHeaderCell, styles.cellWeightSmall, { color: theme.textSecondary }]}>
              kg
            </ThemedText>
          </View>

          {stations.length === 0 ? (
            <View style={styles.emptyRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Keine Daten im Zeitraum
              </ThemedText>
            </View>
          ) : (
            stations.slice(0, 10).map((station, index) => (
              <View 
                key={`${station.stationId}-${station.materialId}-${index}`} 
                style={[
                  styles.tableRow, 
                  index < Math.min(stations.length, 10) - 1 && { borderBottomWidth: 1, borderBottomColor: theme.divider }
                ]}
              >
                <ThemedText type="small" style={[styles.cellStation, { color: theme.text }]} numberOfLines={1}>
                  {station.stationName}
                </ThemedText>
                <ThemedText type="small" style={[styles.cellMaterialSmall, { color: theme.textSecondary }]} numberOfLines={1}>
                  {station.materialName || "-"}
                </ThemedText>
                <ThemedText type="smallBold" style={[styles.cellWeightSmall, { color: theme.text }]}>
                  {formatNumber(parseFloat(station.totalWeightKg || "0"))}
                </ThemedText>
              </View>
            ))
          )}
          {stations.length > 10 ? (
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              + {stations.length - 10} weitere
            </ThemedText>
          ) : null}
        </Card>

        <Card style={{ ...styles.sectionCard, backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}>
          <ThemedText type="h4" style={{ color: theme.text, marginBottom: Spacing.md }}>
            Durchlaufzeiten
          </ThemedText>

          {!leadTimes || leadTimes.taskCount === 0 ? (
            <View style={styles.emptyRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Keine abgeschlossenen Aufgaben im Zeitraum
              </ThemedText>
            </View>
          ) : (
            <View style={styles.leadTimesContainer}>
              <View style={styles.leadTimeRow}>
                <View style={styles.leadTimeLabel}>
                  <Feather name="inbox" size={16} color={theme.statusOpen} />
                  <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, flex: 1 }}>
                    Offen → Abgeholt
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: theme.text }}>
                    {formatHours(leadTimes.avgOpenToPickedUpHours)}
                  </ThemedText>
                </View>
                <ProgressBar 
                  progress={parseFloat(leadTimes.avgOpenToPickedUpHours || "0") / getMaxLeadTime()}
                  color={theme.statusOpen}
                  style={{ marginTop: Spacing.xs }}
                />
              </View>

              <View style={styles.leadTimeRow}>
                <View style={styles.leadTimeLabel}>
                  <Feather name="truck" size={16} color={theme.warning} />
                  <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, flex: 1 }}>
                    Abgeholt → Abgegeben
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: theme.text }}>
                    {formatHours(leadTimes.avgPickedUpToDroppedOffHours)}
                  </ThemedText>
                </View>
                <ProgressBar 
                  progress={parseFloat(leadTimes.avgPickedUpToDroppedOffHours || "0") / getMaxLeadTime()}
                  color={theme.warning}
                  style={{ marginTop: Spacing.xs }}
                />
              </View>

              <View style={styles.leadTimeRow}>
                <View style={styles.leadTimeLabel}>
                  <Feather name="check-circle" size={16} color={theme.success} />
                  <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, flex: 1 }}>
                    Abgegeben → Entsorgt
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: theme.text }}>
                    {formatHours(leadTimes.avgDroppedOffToDisposedHours)}
                  </ThemedText>
                </View>
                <ProgressBar 
                  progress={parseFloat(leadTimes.avgDroppedOffToDisposedHours || "0") / getMaxLeadTime()}
                  color={theme.success}
                  style={{ marginTop: Spacing.xs }}
                />
              </View>

              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                Basierend auf {leadTimes.taskCount} abgeschlossenen Aufgaben
              </ThemedText>
            </View>
          )}
        </Card>

        <Card style={{ ...styles.sectionCard, backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4" style={{ color: theme.text }}>
              Rückstand ({">"}24h)
            </ThemedText>
            {openTasksCount > 0 ? (
              <View style={[styles.backlogBadge, { backgroundColor: theme.warning + "20" }]}>
                <ThemedText type="captionBold" style={{ color: theme.warning }}>
                  {openTasksCount} Aufgaben
                </ThemedText>
              </View>
            ) : null}
          </View>

          {!backlog || backlog.summary.length === 0 ? (
            <View style={styles.emptyRow}>
              <Feather name="check-circle" size={20} color={theme.success} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                Keine überfälligen Aufgaben
              </ThemedText>
            </View>
          ) : (
            <View style={styles.backlogContainer}>
              {backlog.summary.map((item) => (
                <View key={item.status} style={styles.backlogRow}>
                  <View style={[styles.backlogStatusDot, { backgroundColor: getStatusColor(item.status) }]} />
                  <ThemedText type="small" style={{ color: theme.text, flex: 1 }}>
                    {AUTOMOTIVE_TASK_STATUS_LABELS[item.status] || item.status}
                  </ThemedText>
                  <View style={[styles.backlogCount, { backgroundColor: getStatusColor(item.status) + "20" }]}>
                    <ThemedText type="captionBold" style={{ color: getStatusColor(item.status) }}>
                      {item.count}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  dateFilters: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  kpiCard: {
    width: "48%",
    flexGrow: 1,
    minWidth: 140,
  },
  kpiContent: {
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  kpiIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  sectionCard: {
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  cellMaterial: {
    flex: 2,
    paddingRight: Spacing.sm,
  },
  cellCount: {
    width: 60,
    textAlign: "center",
  },
  cellWeight: {
    width: 80,
    textAlign: "right",
  },
  cellStation: {
    flex: 1.5,
    paddingRight: Spacing.sm,
  },
  cellMaterialSmall: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  cellWeightSmall: {
    width: 60,
    textAlign: "right",
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
  },
  leadTimesContainer: {
    gap: Spacing.lg,
  },
  leadTimeRow: {
    gap: Spacing.xs,
  },
  leadTimeLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  backlogContainer: {
    gap: Spacing.md,
  },
  backlogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  backlogStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  backlogCount: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  backlogBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
});
