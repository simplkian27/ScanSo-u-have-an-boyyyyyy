import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { EmptyState } from "@/components/EmptyState";

const OutdoorMap = require("../../assets/images/OUT_1765592733817.png");
const K13Map = require("../../assets/images/K13_1765592733815.png");
const K18Map = require("../../assets/images/K18_1765592733816.png");
const K19Map = require("../../assets/images/K19_1765592733816.png");
const K25Map = require("../../assets/images/K25_1765592733817.png");

interface PositionMeta {
  x: number;
  y: number;
  mapCode?: string;
  label?: string;
}

interface HallData {
  id: string;
  code: string;
  name: string;
  positionMeta: PositionMeta | null;
}

interface StationData {
  id: string;
  code: string;
  name: string;
  hallId: string;
  positionMeta: PositionMeta | null;
}

interface MapData {
  halls: HallData[];
  stations: StationData[];
}

const hallFloorPlans: Record<string, any> = {
  K13: K13Map,
  K18: K18Map,
  K19: K19Map,
  K25: K25Map,
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MAP_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const MAP_ASPECT_RATIO = 1.2;
const MAP_HEIGHT = MAP_WIDTH / MAP_ASPECT_RATIO;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [selectedHall, setSelectedHall] = useState<HallData | null>(null);

  const { data: mapData, isLoading, error } = useQuery<MapData>({
    queryKey: ["/api/factory/map-data"],
  });

  const handleHallPress = (hall: HallData) => {
    if (hallFloorPlans[hall.code]) {
      setSelectedHall(hall);
    }
  };

  const handleBackPress = () => {
    setSelectedHall(null);
  };

  const stationsForHall = selectedHall
    ? mapData?.stations.filter((s) => s.hallId === selectedHall.id) || []
    : [];

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <ThemedText style={styles.loadingText}>Karte wird geladen...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error || !mapData) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <EmptyState
          icon="map"
          title="Kartendaten nicht verfügbar"
          message="Die Werkskarte konnte nicht geladen werden. Bitte versuchen Sie es später erneut."
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["4xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {selectedHall ? (
            <Pressable
              onPress={handleBackPress}
              style={[styles.backButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="arrow-left" size={20} color={theme.text} />
            </Pressable>
          ) : null}
          <ThemedText style={styles.title}>
            {selectedHall ? selectedHall.name : "Werksplan Kaiserslautern"}
          </ThemedText>
        </View>

        <Card style={styles.mapCard}>
          <View style={styles.mapContainer}>
            <Image
              source={selectedHall ? hallFloorPlans[selectedHall.code] : OutdoorMap}
              style={styles.mapImage}
              contentFit="contain"
            />

            {selectedHall ? (
              stationsForHall.map((station) => {
                if (!station.positionMeta) return null;
                const { x, y } = station.positionMeta;
                return (
                  <Pressable
                    key={station.id}
                    style={[
                      styles.marker,
                      styles.stationMarker,
                      {
                        left: x * MAP_WIDTH - 16,
                        top: y * MAP_HEIGHT - 16,
                        backgroundColor: theme.info,
                      },
                    ]}
                  >
                    <Feather name="target" size={16} color="#FFFFFF" />
                  </Pressable>
                );
              })
            ) : (
              mapData.halls.map((hall) => {
                if (!hall.positionMeta) return null;
                const { x, y } = hall.positionMeta;
                const hasFloorPlan = !!hallFloorPlans[hall.code];
                return (
                  <Pressable
                    key={hall.id}
                    onPress={() => handleHallPress(hall)}
                    style={[
                      styles.marker,
                      styles.hallMarker,
                      {
                        left: x * MAP_WIDTH - 20,
                        top: y * MAP_HEIGHT - 20,
                        backgroundColor: hasFloorPlan ? theme.accent : theme.textSecondary,
                      },
                    ]}
                  >
                    <ThemedText style={styles.markerLabel}>{hall.code}</ThemedText>
                  </Pressable>
                );
              })
            )}
          </View>
        </Card>

        {selectedHall ? (
          <View style={styles.legendSection}>
            <ThemedText style={styles.legendTitle}>Stationen in {selectedHall.code}</ThemedText>
            {stationsForHall.length === 0 ? (
              <ThemedText style={styles.legendItem}>Keine Stationen gefunden</ThemedText>
            ) : (
              stationsForHall.map((station) => (
                <View key={station.id} style={styles.stationRow}>
                  <View style={[styles.stationDot, { backgroundColor: theme.info }]} />
                  <View style={styles.stationInfo}>
                    <ThemedText style={styles.stationCode}>{station.code}</ThemedText>
                    <ThemedText style={styles.stationName}>{station.name}</ThemedText>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.legendSection}>
            <ThemedText style={styles.legendTitle}>Gebäude</ThemedText>
            <ThemedText style={styles.legendHint}>
              Tippen Sie auf ein Gebäude um die Stationen anzuzeigen
            </ThemedText>
            <View style={styles.legendItems}>
              {mapData.halls
                .filter((h) => hallFloorPlans[h.code])
                .map((hall) => (
                  <Pressable
                    key={hall.id}
                    onPress={() => handleHallPress(hall)}
                    style={[styles.legendChip, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
                    <ThemedText style={styles.legendChipText}>{hall.code}</ThemedText>
                  </Pressable>
                ))}
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    ...Typography.body,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    ...Typography.h3,
    flex: 1,
  },
  mapCard: {
    overflow: "hidden",
  },
  mapContainer: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    position: "relative",
  },
  mapImage: {
    width: "100%",
    height: "100%",
  },
  marker: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.full,
  },
  hallMarker: {
    width: 40,
    height: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  stationMarker: {
    width: 32,
    height: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  markerLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  legendSection: {
    marginTop: Spacing.xl,
  },
  legendTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  legendHint: {
    ...Typography.small,
    marginBottom: Spacing.lg,
    opacity: 0.7,
  },
  legendItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  legendChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendChipText: {
    ...Typography.smallBold,
  },
  legendItem: {
    ...Typography.body,
    opacity: 0.7,
  },
  stationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  stationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stationInfo: {
    flex: 1,
  },
  stationCode: {
    ...Typography.smallBold,
  },
  stationName: {
    ...Typography.caption,
    opacity: 0.7,
  },
});
