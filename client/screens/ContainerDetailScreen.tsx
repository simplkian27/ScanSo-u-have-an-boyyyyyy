import React from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, Pressable, Platform, Dimensions } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

let MapView: any = null;
let Marker: any = null;
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { Spacing, BorderRadius, AnimationConfig } from "@/constants/theme";
import { ContainersStackParamList } from "@/navigation/ContainersStackNavigator";
import { CustomerContainer, WarehouseContainer, FillHistory } from "@shared/schema";
import { openMapsNavigation } from "@/lib/navigation";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { useTheme } from "@/hooks/useTheme";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withSequence, withTiming, WithSpringConfig } from "react-native-reanimated";

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
  isDark?: boolean;
  backgroundColor?: string;
  borderColor?: string;
}

function GlassPanel({ children, style, intensity = 60, isDark = false, backgroundColor, borderColor }: GlassPanelProps) {
  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={intensity} tint={isDark ? "dark" : "light"} style={[styles.glassPanel, style]}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[
      styles.glassPanel, 
      { 
        backgroundColor: backgroundColor || (isDark ? "rgba(30, 30, 30, 0.95)" : "rgba(255, 255, 255, 0.95)"),
        borderWidth: 1,
        borderColor: borderColor || (isDark ? "#374151" : "#E5E7EB"),
      }, 
      style
    ]}>
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
  const { theme, isDark } = useTheme();
  
  const [isEmptying, setIsEmptying] = React.useState(false);
  const [showAllHistory, setShowAllHistory] = React.useState(false);
  const { showToast } = useToast();
  
  const navButtonScale = useSharedValue(1);
  const shareButtonScale = useSharedValue(1);
  const viewAllScale = useSharedValue(1);
  const emptyButtonScale = useSharedValue(1);

  const { data: container, isLoading } = useQuery<CustomerContainer | WarehouseContainer>({
    queryKey: [`/api/containers/${type}/${containerId}`],
  });

  const { data: fillHistory = [] } = useQuery<FillHistory[]>({
    queryKey: [`/api/containers/warehouse/${containerId}/history`],
    enabled: type === "warehouse",
  });

  const germanMonths = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Nie";
    const d = new Date(date);
    const day = d.getDate();
    const month = germanMonths[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    return `${day}. ${month} ${year}, ${hours}:${minutes}`;
  };

  const formatRelativeTime = (date: string | Date | null) => {
    if (!date) return "Nie";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays === 0) {
      if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;
      return `vor ${diffHours} Std.`;
    }
    if (diffDays === 1) return "Gestern";
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    return formatDate(date);
  };

  const getFillColor = (percentage: number) => {
    if (percentage >= 80) return theme.fillHigh;
    if (percentage >= 51) return theme.fillMedium;
    return theme.fillLow;
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
        "Navigation nicht verfügbar",
        "Für diesen Container sind keine Standortkoordinaten verfügbar.",
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
    Alert.alert("Standort teilen", `Container ${container?.id} bei ${customerContainer.location}`);
  };

  const handleMarkAsEmpty = async () => {
    if (!container || type !== "warehouse") return;
    
    const warehouseData = container as WarehouseContainer;
    if (warehouseData.currentAmount === 0) {
      showToast("Container ist bereits leer", "info");
      return;
    }
    
    Alert.alert(
      "Container leeren",
      `Möchtest du den Füllstand von ${containerId} (${warehouseData.currentAmount.toFixed(0)} ${warehouseData.quantityUnit}) wirklich auf Null setzen?`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Ja, leeren",
          style: "destructive",
          onPress: async () => {
            setIsEmptying(true);
            emptyButtonScale.value = withSequence(
              withTiming(0.95, { duration: 100 }),
              withTiming(1, { duration: 200 })
            );
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await apiRequest("POST", `/api/containers/warehouse/${containerId}/reset`, {
                reason: "Container über Detailansicht geleert",
              });
              queryClient.invalidateQueries({ queryKey: [`/api/containers/${type}/${containerId}`] });
              queryClient.invalidateQueries({ queryKey: ["/api/containers/warehouse"] });
              queryClient.invalidateQueries({ queryKey: [`/api/containers/warehouse/${containerId}/history`] });
              showToast(`Container ${containerId} wurde erfolgreich geleert`, "success");
            } catch (err) {
              console.error("Failed to mark container as empty:", err);
              showToast("Fehler beim Leeren des Containers", "error");
            } finally {
              setIsEmptying(false);
            }
          },
        },
      ]
    );
  };
  
  const emptyButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emptyButtonScale.value }],
  }));

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
        <ActivityIndicator size="large" color={theme.accent} />
      </ThemedView>
    );
  }

  if (!container) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorState}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText type="h4">Container nicht gefunden</ThemedText>
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
        <GlassPanel style={styles.headerCard} isDark={isDark} borderColor={theme.cardBorder}>
          <View style={styles.headerTopRow}>
            <View style={[styles.containerIconWrapper, { backgroundColor: `${theme.accent}15` }]}>
              <Feather 
                name={isWarehouse ? "inbox" : "package"} 
                size={32} 
                color={theme.accent} 
              />
            </View>
            <View style={styles.headerContent}>
              <ThemedText type="h3" style={[styles.containerId, { color: theme.primary }]}>
                {container.id}
              </ThemedText>
              <ThemedText type="body" style={[styles.location, { color: theme.textSecondary }]}>
                {container.location}
              </ThemedText>
            </View>
            <View style={styles.statusBadgeWrapper}>
              <StatusBadge 
                status={isWarehouse ? getFillStatus(fillPercentage) : (daysSinceEmptied && daysSinceEmptied > 30 ? "warning" : "success")} 
                label={isWarehouse ? `${fillPercentage.toFixed(0)}%` : (daysSinceEmptied ? `${daysSinceEmptied}T` : "OK")}
              />
            </View>
          </View>

          <View style={styles.tagRow}>
            <View style={[styles.materialBadge, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="tag" size={14} color={theme.primary} />
              <ThemedText type="small" style={[styles.materialText, { color: theme.primary }]}>
                {container.materialType}
              </ThemedText>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: `${theme.accent}15` }]}>
              <Feather name={isWarehouse ? "home" : "truck"} size={14} color={theme.accent} />
              <ThemedText type="small" style={[styles.typeText, { color: theme.accent }]}>
                {isWarehouse ? "Lager" : "Kunde"}
              </ThemedText>
            </View>
          </View>
        </GlassPanel>

        {isWarehouse ? (
          <GlassPanel style={styles.fillCard} isDark={isDark} borderColor={theme.cardBorder}>
            <View style={styles.sectionHeader}>
              <Feather name="bar-chart-2" size={20} color={theme.primary} />
              <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.primary }]}>
                Füllstand
              </ThemedText>
            </View>
            
            <View style={styles.fillGauge}>
              <View style={[styles.gaugeCircle, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText type="h1" style={[styles.gaugeValue, { color: getFillColor(fillPercentage) }]}>
                  {fillPercentage.toFixed(0)}
                </ThemedText>
                <ThemedText type="caption" style={[styles.gaugeUnit, { color: theme.textSecondary }]}>%</ThemedText>
              </View>
            </View>

            <ProgressBar
              progress={fillPercentage / 100}
              color={getFillColor(fillPercentage)}
              style={styles.progressBar}
            />

            <View style={styles.fillMetrics}>
              <View style={styles.metricItem}>
                <ThemedText type="h4" style={[styles.metricValue, { color: theme.text }]}>
                  {warehouseContainer.currentAmount.toFixed(0)}
                </ThemedText>
                <ThemedText type="caption" style={[styles.metricLabel, { color: theme.textSecondary }]}>kg verwendet</ThemedText>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
              <View style={styles.metricItem}>
                <ThemedText type="h4" style={[styles.metricValue, { color: theme.text }]}>
                  {warehouseContainer.maxCapacity}
                </ThemedText>
                <ThemedText type="caption" style={[styles.metricLabel, { color: theme.textSecondary }]}>kg Kapazität</ThemedText>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
              <View style={styles.metricItem}>
                <ThemedText type="h4" style={[styles.metricValue, { color: theme.text }]}>
                  {(warehouseContainer.maxCapacity - warehouseContainer.currentAmount).toFixed(0)}
                </ThemedText>
                <ThemedText type="caption" style={[styles.metricLabel, { color: theme.textSecondary }]}>kg verfügbar</ThemedText>
              </View>
            </View>

            {fillPercentage >= 80 ? (
              <View style={[styles.alertBanner, { backgroundColor: theme.fillHigh }]}>
                <Feather name="alert-triangle" size={18} color={theme.buttonText} />
                <ThemedText type="small" style={[styles.alertText, { color: theme.buttonText }]}>
                  Container fast voll - Leerung bald einplanen
                </ThemedText>
              </View>
            ) : null}

            <Animated.View style={emptyButtonAnimatedStyle}>
              <Button
                onPress={handleMarkAsEmpty}
                disabled={isEmptying || warehouseContainer.currentAmount === 0}
                style={styles.markEmptyButton}
              >
                <View style={styles.markEmptyContent}>
                  <Feather name="refresh-ccw" size={18} color={theme.buttonText} />
                  <ThemedText type="body" style={[styles.markEmptyText, { color: theme.buttonText }]}>
                    {isEmptying ? "Wird geleert..." : warehouseContainer.currentAmount === 0 ? "Container ist leer" : "Container leeren"}
                  </ThemedText>
                </View>
              </Button>
            </Animated.View>
          </GlassPanel>
        ) : (
          <>
            <GlassPanel style={styles.infoCard} isDark={isDark} borderColor={theme.cardBorder}>
              <View style={styles.sectionHeader}>
                <Feather name="info" size={20} color={theme.primary} />
                <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.primary }]}>
                  Container Details
                </ThemedText>
              </View>
              
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <View style={[styles.infoIconWrapper, { backgroundColor: `${theme.accent}10` }]}>
                    <Feather name="briefcase" size={18} color={theme.accent} />
                  </View>
                  <View style={styles.infoContent}>
                    <ThemedText type="caption" style={[styles.infoLabel, { color: theme.textTertiary }]}>Kunde</ThemedText>
                    <ThemedText type="body" style={[styles.infoValue, { color: theme.text }]}>{customerContainer.customerName}</ThemedText>
                  </View>
                </View>

                <View style={styles.infoItem}>
                  <View style={[styles.infoIconWrapper, { backgroundColor: `${theme.accent}10` }]}>
                    <Feather name="calendar" size={18} color={theme.accent} />
                  </View>
                  <View style={styles.infoContent}>
                    <ThemedText type="caption" style={[styles.infoLabel, { color: theme.textTertiary }]}>Zuletzt geleert</ThemedText>
                    <ThemedText type="body" style={[styles.infoValue, { color: theme.text }]}>
                      {formatDate(customerContainer.lastEmptied)}
                    </ThemedText>
                    {daysSinceEmptied !== null ? (
                      <ThemedText 
                        type="caption" 
                        style={[
                          styles.daysBadge, 
                          { color: daysSinceEmptied > 30 ? theme.fillHigh : theme.fillLow }
                        ]}
                      >
                        vor {daysSinceEmptied} Tagen
                      </ThemedText>
                    ) : null}
                  </View>
                </View>

                <View style={styles.infoItem}>
                  <View style={[styles.infoIconWrapper, { backgroundColor: `${theme.accent}10` }]}>
                    <Feather name="map-pin" size={18} color={theme.accent} />
                  </View>
                  <View style={styles.infoContent}>
                    <ThemedText type="caption" style={[styles.infoLabel, { color: theme.textTertiary }]}>Standort</ThemedText>
                    <ThemedText type="body" style={[styles.infoValue, { color: theme.text }]}>{customerContainer.location}</ThemedText>
                    {hasCoordinates ? (
                      <ThemedText type="caption" style={[styles.coordsText, { color: theme.textTertiary }]}>
                        {customerContainer.latitude?.toFixed(4)}, {customerContainer.longitude?.toFixed(4)}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              </View>
            </GlassPanel>

            {hasCoordinates ? (
              <GlassPanel style={styles.mapCard} isDark={isDark} borderColor={theme.cardBorder}>
                <View style={styles.sectionHeader}>
                  <Feather name="map" size={20} color={theme.primary} />
                  <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.primary }]}>
                    Standort
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
                    <View style={[styles.mapFallback, { backgroundColor: theme.backgroundSecondary }]}>
                      <Feather name="map-pin" size={40} color={theme.accent} />
                      <ThemedText type="body" style={[styles.mapFallbackText, { color: theme.text }]}>
                        {customerContainer.latitude?.toFixed(4)}, {customerContainer.longitude?.toFixed(4)}
                      </ThemedText>
                      <ThemedText type="caption" style={[styles.mapFallbackHint, { color: theme.textSecondary }]}>
                        App in Expo Go öffnen um Karte anzuzeigen
                      </ThemedText>
                    </View>
                  )}
                </View>

                <View style={styles.mapActions}>
                  <AnimatedPressable 
                    style={[styles.mapActionButton, { backgroundColor: theme.accent }, navAnimatedStyle]} 
                    onPress={handleNavigation}
                    onPressIn={() => { navButtonScale.value = withSpring(AnimationConfig.pressScale, springConfig); }}
                    onPressOut={() => { navButtonScale.value = withSpring(1, springConfig); }}
                  >
                    <Feather name="navigation" size={18} color={theme.textOnAccent} />
                    <ThemedText type="small" style={[styles.mapActionText, { color: theme.textOnAccent }]}>
                      Navigation
                    </ThemedText>
                  </AnimatedPressable>
                  <AnimatedPressable 
                    style={[styles.mapActionButton, { backgroundColor: theme.backgroundSecondary }, shareAnimatedStyle]} 
                    onPress={handleShareLocation}
                    onPressIn={() => { shareButtonScale.value = withSpring(AnimationConfig.pressScale, springConfig); }}
                    onPressOut={() => { shareButtonScale.value = withSpring(1, springConfig); }}
                  >
                    <Feather name="share-2" size={18} color={theme.primary} />
                    <ThemedText type="small" style={[styles.mapActionTextSecondary, { color: theme.primary }]}>
                      Teilen
                    </ThemedText>
                  </AnimatedPressable>
                </View>
              </GlassPanel>
            ) : null}
          </>
        )}

        <GlassPanel style={styles.qrCard} isDark={isDark} borderColor={theme.cardBorder}>
          <View style={styles.sectionHeader}>
            <Feather name="maximize" size={20} color={theme.primary} />
            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.primary }]}>
              QR-Code
            </ThemedText>
          </View>
          <View style={styles.qrContainer}>
            <View style={[styles.qrPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="grid" size={64} color={theme.textTertiary} />
            </View>
            <View style={styles.qrCodeWrapper}>
              <ThemedText type="caption" style={[styles.qrLabel, { color: theme.textTertiary }]}>Code</ThemedText>
              <ThemedText type="body" style={[styles.qrCode, { color: theme.text }]}>
                {container.qrCode}
              </ThemedText>
            </View>
          </View>
        </GlassPanel>

        {isWarehouse && fillHistory.length > 0 ? (
          <GlassPanel style={styles.historyCard} isDark={isDark} borderColor={theme.cardBorder}>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={20} color={theme.primary} />
              <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.primary }]}>
                Aktivitätsverlauf
              </ThemedText>
            </View>
            
            <View style={styles.timeline}>
              {(showAllHistory ? fillHistory : fillHistory.slice(0, 8)).map((entry, index) => (
                <View key={entry.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineDot, 
                      { backgroundColor: theme.textTertiary, borderColor: theme.backgroundSecondary },
                      index === 0 ? { backgroundColor: theme.accent, borderColor: `${theme.accent}30` } : null
                    ]} />
                    {index < (showAllHistory ? fillHistory.length - 1 : Math.min(fillHistory.length - 1, 7)) ? (
                      <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                    ) : null}
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <View style={[styles.amountBadge, { backgroundColor: `${theme.fillLow}15` }]}>
                        <Feather name="plus" size={12} color={theme.fillLow} />
                        <ThemedText type="small" style={[styles.amountText, { color: theme.fillLow }]}>
                          {entry.amountAdded.toFixed(0)} kg
                        </ThemedText>
                      </View>
                      <ThemedText type="caption" style={[styles.timelineTime, { color: theme.textSecondary }]}>
                        {formatRelativeTime(entry.createdAt)}
                      </ThemedText>
                    </View>
                    <ThemedText type="caption" style={[styles.timelineDate, { color: theme.textTertiary }]}>
                      {formatDate(entry.createdAt)}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>

            {fillHistory.length > 8 ? (
              <AnimatedPressable 
                style={[styles.viewAllButton, { borderTopColor: theme.border }, viewAllAnimatedStyle]}
                onPress={handleToggleHistory}
                onPressIn={() => { viewAllScale.value = withSpring(AnimationConfig.pressScale, springConfig); }}
                onPressOut={() => { viewAllScale.value = withSpring(1, springConfig); }}
              >
                <ThemedText type="small" style={[styles.viewAllText, { color: theme.accent }]}>
                  {showAllHistory ? "Weniger anzeigen" : `Alle ${fillHistory.length} Einträge anzeigen`}
                </ThemedText>
                <Feather 
                  name={showAllHistory ? "chevron-up" : "chevron-right"} 
                  size={16} 
                  color={theme.accent} 
                />
              </AnimatedPressable>
            ) : null}
          </GlassPanel>
        ) : null}

        {!isWarehouse && !hasCoordinates ? (
          <Pressable style={[styles.actionButton, { backgroundColor: theme.accent }]} onPress={handleNavigation}>
            <Feather name="navigation" size={20} color={theme.textOnAccent} />
            <ThemedText type="body" style={[styles.actionButtonText, { color: theme.textOnAccent }]}>
              In Karten öffnen
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
    justifyContent: "center",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
  },
  containerId: {
    fontWeight: "700",
  },
  location: {
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  materialText: {
    fontWeight: "500",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  typeText: {
    fontWeight: "500",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {},
  fillCard: {},
  fillGauge: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  gaugeCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  gaugeValue: {
    fontWeight: "800",
  },
  gaugeUnit: {
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
  },
  metricValue: {
    fontWeight: "600",
  },
  metricLabel: {
    marginTop: 4,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  alertText: {
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
    justifyContent: "center",
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
    justifyContent: "center",
  },
  infoLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontWeight: "500",
  },
  daysBadge: {
    marginTop: 4,
    fontWeight: "600",
  },
  coordsText: {
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
    gap: Spacing.sm,
  },
  mapFallbackText: {
    fontWeight: "600",
  },
  mapFallbackHint: {},
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
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  mapActionText: {
    fontWeight: "600",
  },
  mapActionTextSecondary: {
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
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  qrCodeWrapper: {
    flex: 1,
  },
  qrLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  qrCode: {
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
    borderWidth: 2,
  },
  timelineLine: {
    flex: 1,
    width: 2,
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  amountText: {
    fontWeight: "600",
  },
  timelineTime: {},
  timelineDate: {},
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  viewAllText: {
    fontWeight: "600",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: {
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
    fontWeight: "600",
  },
});
