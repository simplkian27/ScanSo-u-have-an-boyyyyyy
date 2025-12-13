import React, { useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, Modal, ActivityIndicator, Pressable, Switch, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { FilterChip } from "@/components/FilterChip";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { Spacing, BorderRadius, IndustrialDesign } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

type SectionTab = "stations" | "stands";

interface Hall {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface Station {
  id: string;
  hallId: string;
  name: string;
  code: string;
  isActive: boolean;
  hall?: Hall;
}

interface Material {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface Stand {
  id: string;
  stationId: string;
  identifier: string;
  materialId?: string;
  isActive: boolean;
  station?: Station;
  material?: Material;
}

interface Box {
  id: string;
  standId?: string;
  serial: string;
  status: string;
  isActive: boolean;
}

export default function LayoutManagementScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<SectionTab>("stations");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [moveStationModalVisible, setMoveStationModalVisible] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [selectedHallId, setSelectedHallId] = useState<string>("");

  const [editStandModalVisible, setEditStandModalVisible] = useState(false);
  const [selectedStand, setSelectedStand] = useState<Stand | null>(null);
  const [editMaterialId, setEditMaterialId] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editStationId, setEditStationId] = useState<string>("");

  const { data: halls = [], isLoading: loadingHalls } = useQuery<Hall[]>({
    queryKey: ["/api/halls"],
  });

  const { data: stations = [], isLoading: loadingStations } = useQuery<Station[]>({
    queryKey: ["/api/stations"],
  });

  const { data: stands = [], isLoading: loadingStands } = useQuery<Stand[]>({
    queryKey: ["/api/stands"],
  });

  const { data: materials = [], isLoading: loadingMaterials } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
  });

  const { data: boxes = [] } = useQuery<Box[]>({
    queryKey: ["/api/boxes"],
  });

  const isLoading = activeTab === "stations" 
    ? loadingStations || loadingHalls 
    : loadingStands || loadingStations || loadingMaterials;

  const stationsGroupedByHall = useMemo(() => {
    const grouped: Record<string, { hall: Hall; stations: Station[] }> = {};
    
    halls.forEach(hall => {
      grouped[hall.id] = { hall, stations: [] };
    });
    
    stations.forEach(station => {
      if (grouped[station.hallId]) {
        grouped[station.hallId].stations.push(station);
      }
    });
    
    return Object.values(grouped).filter(g => g.stations.length > 0);
  }, [halls, stations]);

  const standsGroupedByStation = useMemo(() => {
    const grouped: Record<string, { station: Station; stands: Stand[] }> = {};
    
    stations.forEach(station => {
      grouped[station.id] = { station, stands: [] };
    });
    
    stands.forEach(stand => {
      if (grouped[stand.stationId]) {
        grouped[stand.stationId].stands.push(stand);
      }
    });
    
    return Object.values(grouped).filter(g => g.stands.length > 0);
  }, [stations, stands]);

  const getHallName = (hallId: string) => {
    const hall = halls.find(h => h.id === hallId);
    return hall ? hall.name : "-";
  };

  const getMaterialName = (materialId: string | undefined) => {
    if (!materialId) return "-";
    const material = materials.find(m => m.id === materialId);
    return material ? material.name : "-";
  };

  const getStationName = (stationId: string) => {
    const station = stations.find(s => s.id === stationId);
    return station ? station.name : "-";
  };

  const hasBoxOnStand = (standId: string) => {
    return boxes.some(b => b.standId === standId && b.isActive);
  };

  const openMoveStationModal = (station: Station) => {
    setSelectedStation(station);
    setSelectedHallId(station.hallId);
    setMoveStationModalVisible(true);
  };

  const closeMoveStationModal = () => {
    setMoveStationModalVisible(false);
    setSelectedStation(null);
    setSelectedHallId("");
  };

  const handleMoveStation = async () => {
    if (!selectedStation || !selectedHallId) return;
    
    if (selectedHallId === selectedStation.hallId) {
      showToast("Station ist bereits in dieser Halle", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("PATCH", `/api/stations/${selectedStation.id}`, {
        hallId: selectedHallId,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stations"] });
      showToast("Station erfolgreich verschoben", "success");
      closeMoveStationModal();
    } catch (err) {
      console.error("Failed to move station:", err);
      showToast("Fehler beim Verschieben der Station", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditStandModal = (stand: Stand) => {
    setSelectedStand(stand);
    setEditMaterialId(stand.materialId || "");
    setEditIsActive(stand.isActive);
    setEditStationId(stand.stationId);
    setEditStandModalVisible(true);
  };

  const closeEditStandModal = () => {
    setEditStandModalVisible(false);
    setSelectedStand(null);
    setEditMaterialId("");
    setEditIsActive(true);
    setEditStationId("");
  };

  const handleEditStand = async () => {
    if (!selectedStand) return;

    if (!editIsActive && selectedStand.isActive && hasBoxOnStand(selectedStand.id)) {
      Alert.alert(
        "Warnung",
        "Dieser Stellplatz hat eine aktive Box. Beim Deaktivieren wird die Box abgemeldet. Fortfahren?",
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Fortfahren", style: "destructive", onPress: performEditStand },
        ]
      );
      return;
    }

    await performEditStand();
  };

  const performEditStand = async () => {
    if (!selectedStand) return;

    setIsSubmitting(true);
    try {
      const updateData: { materialId?: string | null; isActive?: boolean; stationId?: string } = {};
      
      if (editMaterialId !== (selectedStand.materialId || "")) {
        updateData.materialId = editMaterialId || null;
      }
      if (editIsActive !== selectedStand.isActive) {
        updateData.isActive = editIsActive;
      }
      if (editStationId !== selectedStand.stationId) {
        updateData.stationId = editStationId;
      }

      if (Object.keys(updateData).length === 0) {
        showToast("Keine Änderungen vorgenommen", "warning");
        closeEditStandModal();
        return;
      }

      await apiRequest("PATCH", `/api/stands/${selectedStand.id}`, updateData);
      queryClient.invalidateQueries({ queryKey: ["/api/stands"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boxes"] });
      showToast("Stellplatz erfolgreich aktualisiert", "success");
      closeEditStandModal();
    } catch (err) {
      console.error("Failed to edit stand:", err);
      showToast("Fehler beim Bearbeiten des Stellplatzes", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStationItem = (station: Station) => (
    <Card key={station.id} style={[styles.itemCard, !station.isActive && styles.inactiveCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.itemInfo}>
          <Feather name="map-pin" size={24} color={station.isActive ? theme.primary : theme.textTertiary} />
          <View style={styles.itemDetails}>
            <View style={styles.idRow}>
              <ThemedText type="bodyBold" style={[{ color: theme.text }, !station.isActive && { color: theme.textTertiary }]}>
                {station.name}
              </ThemedText>
              {!station.isActive ? <StatusBadge status="cancelled" label="Inaktiv" size="small" /> : null}
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Code: {station.code}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Halle: {getHallName(station.hallId)}</ThemedText>
          </View>
        </View>
        <Button
          variant="secondary"
          size="small"
          onPress={() => openMoveStationModal(station)}
          style={styles.actionButton}
        >
          <View style={styles.buttonContent}>
            <Feather name="move" size={16} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary }}>Verschieben</ThemedText>
          </View>
        </Button>
      </View>
    </Card>
  );

  const renderStandItem = (stand: Stand) => {
    const hasBox = hasBoxOnStand(stand.id);
    return (
      <Card key={stand.id} style={[styles.itemCard, !stand.isActive && styles.inactiveCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.itemInfo}>
            <Feather name="target" size={24} color={stand.isActive ? theme.primary : theme.textTertiary} />
            <View style={styles.itemDetails}>
              <View style={styles.idRow}>
                <ThemedText type="bodyBold" style={[{ color: theme.text }, !stand.isActive && { color: theme.textTertiary }]}>
                  {stand.identifier}
                </ThemedText>
                {!stand.isActive ? <StatusBadge status="cancelled" label="Inaktiv" size="small" /> : null}
                {hasBox ? <StatusBadge status="inProgress" label="Box" size="small" /> : null}
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Material: {getMaterialName(stand.materialId)}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Station: {getStationName(stand.stationId)}</ThemedText>
            </View>
          </View>
          <Button
            variant="secondary"
            size="small"
            onPress={() => openEditStandModal(stand)}
            style={styles.actionButton}
          >
            <View style={styles.buttonContent}>
              <Feather name="edit-2" size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary }}>Bearbeiten</ThemedText>
            </View>
          </Button>
        </View>
      </Card>
    );
  };

  const renderDropdownOption = (
    id: string,
    label: string,
    isSelected: boolean,
    onPress: () => void
  ) => (
    <Pressable
      key={id}
      style={[
        styles.dropdownOption,
        { 
          backgroundColor: isSelected ? theme.accent : theme.cardSurface,
          borderColor: isSelected ? theme.accent : theme.border,
        }
      ]}
      onPress={onPress}
    >
      <ThemedText 
        type="body" 
        style={{ color: isSelected ? theme.textOnAccent : theme.text }}
      >
        {label}
      </ThemedText>
      {isSelected ? (
        <Feather name="check" size={18} color={theme.textOnAccent} />
      ) : null}
    </Pressable>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabsContainer}>
          <FilterChip
            label="Stationen"
            selected={activeTab === "stations"}
            onPress={() => setActiveTab("stations")}
          />
          <FilterChip
            label="Stellplätze"
            selected={activeTab === "stands"}
            onPress={() => setActiveTab("stands")}
          />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : activeTab === "stations" ? (
          <View style={styles.listContainer}>
            {stationsGroupedByHall.length === 0 ? (
              <Card style={styles.emptyCard}>
                <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
                  Keine Stationen gefunden
                </ThemedText>
              </Card>
            ) : (
              stationsGroupedByHall.map(group => (
                <View key={group.hall.id} style={styles.groupContainer}>
                  <View style={styles.groupHeader}>
                    <Feather name="home" size={18} color={theme.primary} />
                    <ThemedText type="h4" style={{ color: theme.primary }}>
                      {group.hall.name}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      ({group.stations.length} Stationen)
                    </ThemedText>
                  </View>
                  {group.stations.map(renderStationItem)}
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {standsGroupedByStation.length === 0 ? (
              <Card style={styles.emptyCard}>
                <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
                  Keine Stellplätze gefunden
                </ThemedText>
              </Card>
            ) : (
              standsGroupedByStation.map(group => (
                <View key={group.station.id} style={styles.groupContainer}>
                  <View style={styles.groupHeader}>
                    <Feather name="map-pin" size={18} color={theme.primary} />
                    <ThemedText type="h4" style={{ color: theme.primary }}>
                      {group.station.name}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      ({group.stands.length} Stellplätze)
                    </ThemedText>
                  </View>
                  {group.stands.map(renderStandItem)}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={moveStationModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeMoveStationModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardSurface }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Station verschieben</ThemedText>
              <Pressable onPress={closeMoveStationModal} style={styles.closeButton}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {selectedStation ? (
              <ThemedText type="body" style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                {selectedStation.name} ({selectedStation.code})
              </ThemedText>
            ) : null}

            <ThemedText type="smallBold" style={[styles.fieldLabel, { color: theme.text }]}>
              Ziel-Halle auswählen:
            </ThemedText>

            <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
              {halls.filter(h => h.isActive).map(hall =>
                renderDropdownOption(
                  hall.id,
                  `${hall.name} (${hall.code})`,
                  selectedHallId === hall.id,
                  () => setSelectedHallId(hall.id)
                )
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                variant="secondary"
                onPress={closeMoveStationModal}
                style={styles.modalButton}
              >
                Abbrechen
              </Button>
              <Button
                variant="primary"
                onPress={handleMoveStation}
                loading={isSubmitting}
                disabled={!selectedHallId || isSubmitting}
                style={styles.modalButton}
              >
                Verschieben
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editStandModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeEditStandModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardSurface }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Stellplatz bearbeiten</ThemedText>
              <Pressable onPress={closeEditStandModal} style={styles.closeButton}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {selectedStand ? (
              <ThemedText type="body" style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                {selectedStand.identifier}
              </ThemedText>
            ) : null}

            <View style={styles.toggleRow}>
              <ThemedText type="bodyBold" style={{ color: theme.text }}>Aktiv</ThemedText>
              <Switch
                value={editIsActive}
                onValueChange={setEditIsActive}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={editIsActive ? theme.cardSurface : theme.textTertiary}
              />
            </View>

            {!editIsActive && selectedStand && hasBoxOnStand(selectedStand.id) ? (
              <View style={[styles.warningBanner, { backgroundColor: theme.warningLight }]}>
                <Feather name="alert-triangle" size={18} color={theme.warning} />
                <ThemedText type="small" style={{ color: theme.warning, flex: 1 }}>
                  Dieser Stellplatz hat eine Box. Beim Deaktivieren wird die Box abgemeldet.
                </ThemedText>
              </View>
            ) : null}

            <ThemedText type="smallBold" style={[styles.fieldLabel, { color: theme.text }]}>
              Material:
            </ThemedText>

            <ScrollView style={styles.optionsContainerSmall} showsVerticalScrollIndicator={false}>
              {renderDropdownOption(
                "",
                "Kein Material",
                editMaterialId === "",
                () => setEditMaterialId("")
              )}
              {materials.filter(m => m.isActive).map(material =>
                renderDropdownOption(
                  material.id,
                  material.name,
                  editMaterialId === material.id,
                  () => setEditMaterialId(material.id)
                )
              )}
            </ScrollView>

            <ThemedText type="smallBold" style={[styles.fieldLabel, { color: theme.text }]}>
              Station (verschieben):
            </ThemedText>

            <ScrollView style={styles.optionsContainerSmall} showsVerticalScrollIndicator={false}>
              {stations.filter(s => s.isActive).map(station =>
                renderDropdownOption(
                  station.id,
                  `${station.name} (${getHallName(station.hallId)})`,
                  editStationId === station.id,
                  () => setEditStationId(station.id)
                )
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                variant="secondary"
                onPress={closeEditStandModal}
                style={styles.modalButton}
              >
                Abbrechen
              </Button>
              <Button
                variant="primary"
                onPress={handleEditStand}
                loading={isSubmitting}
                disabled={isSubmitting}
                style={styles.modalButton}
              >
                Speichern
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  tabsContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  listContainer: {
    gap: Spacing.lg,
  },
  groupContainer: {
    gap: Spacing.sm,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  itemCard: {
    marginBottom: Spacing.sm,
  },
  inactiveCard: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  itemDetails: {
    flex: 1,
    gap: 2,
  },
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  actionButton: {
    minWidth: 100,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  emptyCard: {
    padding: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  modalSubtitle: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  optionsContainer: {
    maxHeight: 200,
  },
  optionsContainerSmall: {
    maxHeight: 120,
  },
  dropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  modalButton: {
    flex: 1,
  },
});
