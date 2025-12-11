import React from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, Pressable, Platform, Dimensions } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

// react-native-maps requires native modules not available in Expo Go
// Using fallback UI for all platforms to prevent TurboModule crashes
let MapView: any = null;
let Marker: any = null;
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { Colors, Spacing, BorderRadius, AnimationConfig } from "@/constants/theme";
import { ContainersStackParamList } from "@/navigation/ContainersStackNavigator";
import { CustomerContainer, WarehouseContainer, FillHistory } from "@shared/schema";
import { openMapsNavigation } from "@/lib/navigation";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/Button";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, WithSpringConfig } from "react-native-reanimated";

const springConfig: WithSpringConfig = {
  damping: AnimationConfig.spring.damping,
  mass: AnimationConfig.spring.mass,
  stiffness: AnimationConfig.spring.stiffness,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type RouteProps = RouteProp<ContainersStackParamList, "ContainerDetail">;

const { width: screenWidth } = Dimensions.get("window");

interface GlassPanelProps {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
}

function GlassPanel({ children, style, intensity = 60 }: GlassPanelProps) {
  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={intensity} tint="light" style={[styles.glassPanel, style]}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[styles.glassPanel, styles.glassPanelFallback, style]}>
      {children}
    </View>
  );
}

export default function ContainerDetailScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const route = useRoute<RouteProps>();
  const { containerId, type } = route.params;
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  const [isEmptying, setIsEmptying] = React.useState(false);
  const [showAllHistory, setShowAllHistory] = React.useState(false);
  
  const navButtonScale = useSharedValue(1);
  const shareButtonScale = useSharedValue(1);
  const viewAllScale = useSharedValue(1);

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

  const formatRelativeTime = (date: string | Date | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
  };

  const getFillColor = (percentage: number) => {
    if (percentage >= 80) return Colors.light.fillHigh;
    if (percentage >= 51) return Colors.light.fillMedium;
    return Colors.light.fillLow;
  };

  const getFillStatus = (percentage: number): "critical" | "warning" | "success" => {
    if (percentage >= 80) return "critical";
    if (percentage >= 51) return "warning";
    return "success";
  };

  const getDaysSinceEmptied = (lastEmptied: string | Date | null) => {
    if (!lastEmptied) return null;
    const d = new Date(lastEmptied);
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
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

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await openMapsNavigation({
      latitude: customerContainer.latitude,
      longitude: customerContainer.longitude,
      label: `${customerContainer.customerName} - ${customerContainer.location}`,
    });
  };

  const handleShareLocation = async () => {
    const customerContainer = container as CustomerContainer;
    if (!customerContainer?.latitude || !customerContainer?.longitude) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Share Location", `Container ${container?.id} at ${customerContainer.location}`);
  };

  const handleMarkAsEmpty = async () => {
    if (!container || type !== "warehouse") return;
    
    Alert.alert(
      "Mark Container Empty",
      "This will reset the container fill level to 0 kg and record the emptying time. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Empty",
          onPress: async () => {
            setIsEmptying(true);
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await apiRequest("PATCH", `/api/containers/warehouse/${containerId}`, {
                currentAmount: 0,
                lastEmptied: new Date().toISOString(),
              });
              queryClient.invalidateQueries({ queryKey: [`/api/containers/${type}/${containerId}`] });
              queryClient.invalidateQueries({ queryKey: ["/api/containers/warehouse"] });
              Alert.alert("Success", "Container marked as empty");
            } catch (err) {
              console.error("Failed to mark container as empty:", err);
              Alert.alert("Error", "Failed to mark container as empty. Please try again.");
            } finally {
              setIsEmptying(false);
            }
          },
        },
      ]
    );
  };

  const handleToggleHistory = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAllHistory(!showAllHistory);
  };

  const navAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: navButtonScale.value }],
  }));

  const shareAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shareButtonScale.value }],
  }));

  const viewAllAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: viewAllScale.value }],
  }));

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
  const daysSinceEmptied = !isWarehouse ? getDaysSinceEmptied(customerContainer.lastEmptied) : null;
  const hasCoordinates = !isWarehouse && customerContainer.latitude && customerContainer.longitude;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <GlassPanel style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.containerIconWrapper}>
              <Feather 
                name={isWarehouse ? "inbox" : "package"} 
                size={32} 
                color={Colors.light.accent} 
              />
            </View>
            <View style={styles.headerContent}>
              <ThemedText type="h3" style={styles.containerId}>
                {container.id}
              </ThemedText>
              <ThemedText type="body" style={styles.location}>
                {container.location}
              </ThemedText>
            </View>
            <View style={styles.statusBadgeWrapper}>
              <StatusBadge 
                status={isWarehouse ? getFillStatus(fillPercentage) : (daysSinceEmptied && daysSinceEmptied > 30 ? "warning" : "success")} 
                label={isWarehouse ? `${fillPercentage.toFixed(0)}%` : (daysSinceEmptied ? `${daysSinceEmptied}d` : "OK")}
              />
            </View>
          </View>

          <View style={styles.tagRow}>
            <View style={styles.materialBadge}>
              <Feather name="tag" size={14} color={Colors.light.primary} />
              <ThemedText type="small" style={styles.materialText}>
                {container.materialType}
              </ThemedText>
            </View>
            <View style={styles.typeBadge}>
              <Feather name={isWarehouse ? "home" : "truck"} size={14} color={Colors.light.accent} />
              <ThemedText type="small" style={styles.typeText}>
                {isWarehouse ? "Warehouse" : "Customer"}
              </ThemedText>
            </View>
          </View>
        </GlassPanel>

        {isWarehouse ? (
          <GlassPanel style={styles.fillCard}>
            <View style={styles.sectionHeader}>
              <Feather name="bar-chart-2" size={20} color={Colors.light.primary} />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Fill Level
              </ThemedText>
            </View>
            
            <View style={styles.fillGauge}>
              <View style={styles.gaugeCircle}>
                <ThemedText type="h1" style={[styles.gaugeValue, { color: getFillColor(fillPercentage) }]}>
                  {fillPercentage.toFixed(0)}
                </ThemedText>
                <ThemedText type="caption" style={styles.gaugeUnit}>%</ThemedText>
              </View>
            </View>

            <ProgressBar
              progress={fillPercentage / 100}
              color={getFillColor(fillPercentage)}
              style={styles.progressBar}
            />

            <View style={styles.fillMetrics}>
              <View style={styles.metricItem}>
                <ThemedText type="h4" style={styles.metricValue}>
                  {warehouseContainer.currentAmount.toFixed(0)}
                </ThemedText>
                <ThemedText type="caption" style={styles.metricLabel}>kg Used</ThemedText>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <ThemedText type="h4" style={styles.metricValue}>
                  {warehouseContainer.maxCapacity}
                </ThemedText>
                <ThemedText type="caption" style={styles.metricLabel}>kg Capacity</ThemedText>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <ThemedText type="h4" style={styles.metricValue}>
                  {(warehouseContainer.maxCapacity - warehouseContainer.currentAmount).toFixed(0)}
                </ThemedText>
                <ThemedText type="caption" style={styles.metricLabel}>kg Available</ThemedText>
              </View>
            </View>

            {fillPercentage >= 80 ? (
              <View style={styles.alertBanner}>
                <Feather name="alert-triangle" size={18} color="#FFFFFF" />
                <ThemedText type="small" style={styles.alertText}>
                  Container almost full - schedule emptying soon
                </ThemedText>
              </View>
            ) : null}

            {isAdmin ? (
              <Button
                onPress={handleMarkAsEmpty}
                disabled={isEmptying || warehouseContainer.currentAmount === 0}
                style={styles.markEmptyButton}
              >
                <View style={styles.markEmptyContent}>
                  <Feather name="refresh-ccw" size={18} color="#FFFFFF" />
                  <ThemedText type="body" style={styles.markEmptyText}>
                    {isEmptying ? "Marking Empty..." : "Mark Container Empty"}
                  </ThemedText>
                </View>
              </Button>
            ) : null}
          </GlassPanel>
        ) : (
          <>
            <GlassPanel style={styles.infoCard}>
              <View style={styles.sectionHeader}>
                <Feather name="info" size={20} color={Colors.light.primary} />
                <ThemedText type="h4" style={styles.sectionTitle}>
                  Container Details
                </ThemedText>
              </View>
              
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrapper}>
                    <Feather name="briefcase" size={18} color={Colors.light.accent} />
                  </View>
                  <View style={styles.infoContent}>
                    <ThemedText type="caption" style={styles.infoLabel}>Customer</ThemedText>
                    <ThemedText type="body" style={styles.infoValue}>{customerContainer.customerName}</ThemedText>
                  </View>
                </View>

                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrapper}>
                    <Feather name="calendar" size={18} color={Colors.light.accent} />
                  </View>
                  <View style={styles.infoContent}>
                    <ThemedText type="caption" style={styles.infoLabel}>Last Emptied</ThemedText>
                    <ThemedText type="body" style={styles.infoValue}>
                      {formatDate(customerContainer.lastEmptied)}
                    </ThemedText>
                    {daysSinceEmptied !== null ? (
                      <ThemedText 
                        type="caption" 
                        style={[
                          styles.daysBadge, 
                          { color: daysSinceEmptied > 30 ? Colors.light.fillHigh : Colors.light.fillLow }
                        ]}
                      >
                        {daysSinceEmptied} days ago
                      </ThemedText>
                    ) : null}
                  </View>
                </View>

                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrapper}>
                    <Feather name="map-pin" size={18} color={Colors.light.accent} />
                  </View>
                  <View style={styles.infoContent}>
                    <ThemedText type="caption" style={styles.infoLabel}>Location</ThemedText>
                    <ThemedText type="body" style={styles.infoValue}>{customerContainer.location}</ThemedText>
                    {hasCoordinates ? (
                      <ThemedText type="caption" style={styles.coordsText}>
                        {customerContainer.latitude?.toFixed(4)}, {customerContainer.longitude?.toFixed(4)}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              </View>
            </GlassPanel>

            {hasCoordinates ? (
              <GlassPanel style={styles.mapCard}>
                <View style={styles.sectionHeader}>
                  <Feather name="map" size={20} color={Colors.light.primary} />
                  <ThemedText type="h4" style={styles.sectionTitle}>
                    Location
                  </ThemedText>
                </View>
                
                <View style={styles.mapContainer}>
                  {MapView && Platform.OS !== "web" ? (
                    <MapView
                      style={styles.map}
                      initialRegion={{
                        latitude: customerContainer.latitude!,
                        longitude: customerContainer.longitude!,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                    >
                      {Marker ? (
                        <Marker
                          coordinate={{
                            latitude: customerContainer.latitude!,
                            longitude: customerContainer.longitude!,
                          }}
                          title={customerContainer.customerName}
                          description={customerContainer.location}
                        />
                      ) : null}
                    </MapView>
                  ) : (
                    <View style={styles.mapFallback}>
                      <Feather name="map-pin" size={40} color={Colors.light.accent} />
                      <ThemedText type="body" style={styles.mapFallbackText}>
                        {customerContainer.latitude?.toFixed(4)}, {customerContainer.longitude?.toFixed(4)}
                      </ThemedText>
                      <ThemedText type="caption" style={styles.mapFallbackHint}>
                        Run in Expo Go to view map
                      </ThemedText>
                    </View>
                  )}
                </View>

                <View style={styles.mapActions}>
                  <AnimatedPressable 
                    style={[styles.mapActionButton, navAnimatedStyle]} 
                    onPress={handleNavigation}
                    onPressIn={() => { navButtonScale.value = withSpring(AnimationConfig.pressScale, springConfig); }}
                    onPressOut={() => { navButtonScale.value = withSpring(1, springConfig); }}
                  >
                    <Feather name="navigation" size={18} color={Colors.light.textOnAccent} />
                    <ThemedText type="small" style={styles.mapActionText}>
                      Navigate
                    </ThemedText>
                  </AnimatedPressable>
                  <AnimatedPressable 
                    style={[styles.mapActionButton, styles.mapActionSecondary, shareAnimatedStyle]} 
                    onPress={handleShareLocation}
                    onPressIn={() => { shareButtonScale.value = withSpring(AnimationConfig.pressScale, springConfig); }}
                    onPressOut={() => { shareButtonScale.value = withSpring(1, springConfig); }}
                  >
                    <Feather name="share-2" size={18} color={Colors.light.primary} />
                    <ThemedText type="small" style={styles.mapActionTextSecondary}>
                      Share
                    </ThemedText>
                  </AnimatedPressable>
                </View>
              </GlassPanel>
            ) : null}
          </>
        )}

        <GlassPanel style={styles.qrCard}>
          <View style={styles.sectionHeader}>
            <Feather name="maximize" size={20} color={Colors.light.primary} />
            <ThemedText type="h4" style={styles.sectionTitle}>
              QR Code
            </ThemedText>
          </View>
          <View style={styles.qrContainer}>
            <View style={styles.qrPlaceholder}>
              <Feather name="grid" size={64} color={Colors.light.textTertiary} />
            </View>
            <View style={styles.qrCodeWrapper}>
              <ThemedText type="caption" style={styles.qrLabel}>Code</ThemedText>
              <ThemedText type="body" style={styles.qrCode}>
                {container.qrCode}
              </ThemedText>
            </View>
          </View>
        </GlassPanel>

        {isWarehouse && fillHistory.length > 0 ? (
          <GlassPanel style={styles.historyCard}>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={20} color={Colors.light.primary} />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Activity Timeline
              </ThemedText>
            </View>
            
            <View style={styles.timeline}>
              {(showAllHistory ? fillHistory : fillHistory.slice(0, 8)).map((entry, index) => (
                <View key={entry.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineDot, 
                      index === 0 ? styles.timelineDotActive : null
                    ]} />
                    {index < (showAllHistory ? fillHistory.length - 1 : Math.min(fillHistory.length - 1, 7)) ? (
                      <View style={styles.timelineLine} />
                    ) : null}
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <View style={styles.amountBadge}>
                        <Feather name="plus" size={12} color={Colors.light.fillLow} />
                        <ThemedText type="small" style={styles.amountText}>
                          {entry.amountAdded.toFixed(0)} kg
                        </ThemedText>
                      </View>
                      <ThemedText type="caption" style={styles.timelineTime}>
                        {formatRelativeTime(entry.createdAt)}
                      </ThemedText>
                    </View>
                    <ThemedText type="caption" style={styles.timelineDate}>
                      {formatDate(entry.createdAt)}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>

            {fillHistory.length > 8 ? (
              <AnimatedPressable 
                style={[styles.viewAllButton, viewAllAnimatedStyle]}
                onPress={handleToggleHistory}
                onPressIn={() => { viewAllScale.value = withSpring(AnimationConfig.pressScale, springConfig); }}
                onPressOut={() => { viewAllScale.value = withSpring(1, springConfig); }}
              >
                <ThemedText type="small" style={styles.viewAllText}>
                  {showAllHistory ? "Show less" : `View all ${fillHistory.length} entries`}
                </ThemedText>
                <Feather 
                  name={showAllHistory ? "chevron-up" : "chevron-right"} 
                  size={16} 
                  color={Colors.light.accent} 
                />
              </AnimatedPressable>
            ) : null}
          </GlassPanel>
        ) : null}

        {!isWarehouse && !hasCoordinates ? (
          <Pressable style={styles.actionButton} onPress={handleNavigation}>
            <Feather name="navigation" size={20} color={Colors.light.textOnAccent} />
            <ThemedText type="body" style={styles.actionButtonText}>
              Open in Maps
            </ThemedText>
          </Pressable>
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
  glassPanel: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    padding: Spacing.lg,
  },
  glassPanelFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  headerCard: {},
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  containerIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.light.accent}15`,
    justifyContent: "center",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
  },
  containerId: {
    color: Colors.light.primary,
    fontWeight: "700",
  },
  location: {
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  statusBadgeWrapper: {},
  tagRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  materialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  materialText: {
    color: Colors.light.primary,
    fontWeight: "500",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: `${Colors.light.accent}15`,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  typeText: {
    color: Colors.light.accent,
    fontWeight: "500",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.light.primary,
  },
  fillCard: {},
  fillGauge: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  gaugeCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  gaugeValue: {
    fontWeight: "800",
  },
  gaugeUnit: {
    color: Colors.light.textSecondary,
    marginLeft: 2,
    marginTop: 8,
  },
  progressBar: {
    height: 10,
    marginBottom: Spacing.lg,
    borderRadius: 5,
  },
  fillMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  metricItem: {
    alignItems: "center",
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.light.border,
  },
  metricValue: {
    color: Colors.light.text,
    fontWeight: "600",
  },
  metricLabel: {
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.light.fillHigh,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  alertText: {
    color: "#FFFFFF",
    flex: 1,
    fontWeight: "500",
  },
  infoCard: {},
  infoGrid: {
    gap: Spacing.lg,
  },
  infoItem: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  infoIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${Colors.light.accent}10`,
    justifyContent: "center",
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
    justifyContent: "center",
  },
  infoLabel: {
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    color: Colors.light.text,
    fontWeight: "500",
  },
  daysBadge: {
    marginTop: 4,
    fontWeight: "600",
  },
  coordsText: {
    color: Colors.light.textTertiary,
    marginTop: 4,
    fontFamily: "monospace",
  },
  mapCard: {},
  mapContainer: {
    height: 180,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    gap: Spacing.sm,
  },
  mapFallbackText: {
    color: Colors.light.text,
    fontWeight: "600",
  },
  mapFallbackHint: {
    color: Colors.light.textSecondary,
  },
  mapActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  mapActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.light.accent,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  mapActionSecondary: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  mapActionText: {
    color: Colors.light.textOnAccent,
    fontWeight: "600",
  },
  mapActionTextSecondary: {
    color: Colors.light.primary,
    fontWeight: "600",
  },
  qrCard: {},
  qrContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  qrPlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  qrCodeWrapper: {
    flex: 1,
  },
  qrLabel: {
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  qrCode: {
    color: Colors.light.text,
    fontFamily: "monospace",
    fontWeight: "600",
  },
  historyCard: {},
  timeline: {
    paddingLeft: Spacing.xs,
  },
  timelineItem: {
    flexDirection: "row",
    minHeight: 60,
  },
  timelineLeft: {
    alignItems: "center",
    width: 24,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.textTertiary,
    borderWidth: 2,
    borderColor: Colors.light.backgroundSecondary,
  },
  timelineDotActive: {
    backgroundColor: Colors.light.accent,
    borderColor: `${Colors.light.accent}30`,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.light.border,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: Spacing.md,
    paddingBottom: Spacing.md,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  amountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${Colors.light.fillLow}15`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  amountText: {
    color: Colors.light.fillLow,
    fontWeight: "600",
  },
  timelineTime: {
    color: Colors.light.textSecondary,
  },
  timelineDate: {
    color: Colors.light.textTertiary,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  viewAllText: {
    color: Colors.light.accent,
    fontWeight: "600",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.light.accent,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: {
    color: Colors.light.textOnAccent,
    fontWeight: "600",
  },
  markEmptyButton: {
    marginTop: Spacing.lg,
  },
  markEmptyContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  markEmptyText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
