import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import ViewShot from "react-native-view-shot";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { EmptyState } from "@/components/EmptyState";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

type EntityType = "HALL" | "STATION" | "STAND" | "BOX" | "WAREHOUSE_CONTAINER";

interface Entity {
  id: string;
  name: string;
  type: EntityType;
  qrCode?: string;
  metadata?: Record<string, unknown>;
}

const ENTITY_TYPES: { key: EntityType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "HALL", label: "Halle", icon: "home" },
  { key: "STATION", label: "Station", icon: "map-pin" },
  { key: "STAND", label: "Stellplatz", icon: "square" },
  { key: "BOX", label: "Box", icon: "box" },
  { key: "WAREHOUSE_CONTAINER", label: "Lager", icon: "package" },
];

export default function QRCenterScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const viewShotRef = useRef<ViewShot>(null);

  const [selectedType, setSelectedType] = useState<EntityType>("HALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { data: entities, isLoading, refetch, isRefetching } = useQuery<Entity[]>({
    queryKey: ["/api/qr/entities", { type: selectedType, query: searchQuery }],
  });

  const ensureMutation = useMutation({
    mutationFn: async ({ type, id }: { type: EntityType; id: string }) => {
      const response = await apiRequest("POST", "/api/qr/ensure", { type, id });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qr/entities"] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async ({ type, id }: { type: EntityType; id: string }) => {
      const response = await apiRequest("POST", "/api/qr/regenerate", { type, id });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qr/entities"] });
      setModalVisible(false);
      setSelectedEntity(null);
    },
  });

  const handleEntityPress = useCallback((entity: Entity) => {
    setSelectedEntity(entity);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedEntity(null);
  }, []);

  const handleSaveImage = useCallback(async () => {
    if (!viewShotRef.current || !selectedEntity) return;

    try {
      const uri = await viewShotRef.current.capture?.();
      if (!uri) {
        Alert.alert("Fehler", "Bild konnte nicht erstellt werden.");
        return;
      }

      const fileName = `qr_${selectedEntity.type}_${selectedEntity.id}_${Date.now()}.png`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.copyAsync({ from: uri, to: fileUri });
      Alert.alert("Erfolg", `QR-Code wurde gespeichert als ${fileName}`);
    } catch (error) {
      console.error("Save image error:", error);
      Alert.alert("Fehler", "Bild konnte nicht gespeichert werden.");
    }
  }, [selectedEntity]);

  const handleShare = useCallback(async () => {
    if (!viewShotRef.current || !selectedEntity) return;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Fehler", "Teilen ist auf diesem Gerät nicht verfügbar.");
        return;
      }

      const uri = await viewShotRef.current.capture?.();
      if (!uri) {
        Alert.alert("Fehler", "Bild konnte nicht erstellt werden.");
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: `QR-Code für ${selectedEntity.name}`,
      });
    } catch (error) {
      console.error("Share error:", error);
      Alert.alert("Fehler", "Teilen fehlgeschlagen.");
    }
  }, [selectedEntity]);

  const handleRegenerate = useCallback(() => {
    if (!selectedEntity) return;

    Alert.alert(
      "QR-Code neu generieren",
      `Möchten Sie den QR-Code für "${selectedEntity.name}" wirklich neu generieren? Der alte Code wird ungültig.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Neu generieren",
          style: "destructive",
          onPress: () => {
            regenerateMutation.mutate({
              type: selectedEntity.type,
              id: selectedEntity.id,
            });
          },
        },
      ]
    );
  }, [selectedEntity, regenerateMutation]);

  const getEntityTypeLabel = (type: EntityType): string => {
    const found = ENTITY_TYPES.find((t) => t.key === type);
    return found?.label || type;
  };

  const renderEntityItem = useCallback(
    ({ item }: { item: Entity }) => (
      <Card
        style={[styles.entityCard, { backgroundColor: theme.cardSurface }]}
        onPress={() => handleEntityPress(item)}
      >
        <View style={styles.entityRow}>
          <View style={styles.entityInfo}>
            <ThemedText type="bodyBold" style={{ color: theme.text }}>
              {item.name}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {getEntityTypeLabel(item.type)}
            </ThemedText>
          </View>
          <View style={[styles.qrPreview, { backgroundColor: theme.backgroundDefault }]}>
            {item.qrCode ? (
              <QRCode
                value={item.qrCode}
                size={48}
                backgroundColor="transparent"
                color={theme.text}
              />
            ) : (
              <Feather name="help-circle" size={24} color={theme.textTertiary} />
            )}
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
      </Card>
    ),
    [theme, handleEntityPress]
  );

  const renderTypeSelector = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.typeSelector}
      contentContainerStyle={styles.typeSelectorContent}
    >
      {ENTITY_TYPES.map((type) => {
        const isSelected = selectedType === type.key;
        return (
          <Pressable
            key={type.key}
            style={[
              styles.typeButton,
              {
                backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
                borderColor: isSelected ? theme.primary : theme.border,
              },
            ]}
            onPress={() => setSelectedType(type.key)}
          >
            <Feather
              name={type.icon}
              size={16}
              color={isSelected ? theme.textOnPrimary : theme.text}
            />
            <ThemedText
              type="small"
              style={{
                color: isSelected ? theme.textOnPrimary : theme.text,
                fontWeight: isSelected ? "600" : "400",
              }}
            >
              {type.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCloseModal}
    >
      <ThemedView style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <ThemedText type="h4" style={{ color: theme.text }}>
            QR-Code Details
          </ThemedText>
          <Pressable onPress={handleCloseModal} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.modalContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {selectedEntity ? (
            <>
              <ViewShot
                ref={viewShotRef}
                options={{ format: "png", quality: 1 }}
                style={[styles.qrContainer, { backgroundColor: "#FFFFFF" }]}
              >
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={selectedEntity.qrCode || `${selectedEntity.type}:${selectedEntity.id}`}
                    size={200}
                    backgroundColor="#FFFFFF"
                    color="#000000"
                  />
                </View>
                <View style={styles.qrLabel}>
                  <ThemedText type="bodyBold" style={{ color: "#000000", textAlign: "center" }}>
                    {selectedEntity.name}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: "#666666", textAlign: "center" }}>
                    {getEntityTypeLabel(selectedEntity.type)}
                  </ThemedText>
                </View>
              </ViewShot>

              <Card style={[styles.metadataCard, { backgroundColor: theme.cardSurface }]}>
                <ThemedText type="h4" style={{ color: theme.primary, marginBottom: Spacing.sm }}>
                  Informationen
                </ThemedText>
                <View style={styles.metadataRow}>
                  <Feather name="tag" size={18} color={theme.textSecondary} />
                  <View style={styles.metadataContent}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Name
                    </ThemedText>
                    <ThemedText type="body" style={{ color: theme.text }}>
                      {selectedEntity.name}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.metadataRow}>
                  <Feather name="layers" size={18} color={theme.textSecondary} />
                  <View style={styles.metadataContent}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Typ
                    </ThemedText>
                    <ThemedText type="body" style={{ color: theme.text }}>
                      {getEntityTypeLabel(selectedEntity.type)}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.metadataRow}>
                  <Feather name="hash" size={18} color={theme.textSecondary} />
                  <View style={styles.metadataContent}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      ID
                    </ThemedText>
                    <ThemedText type="body" style={{ color: theme.text }}>
                      {selectedEntity.id}
                    </ThemedText>
                  </View>
                </View>
              </Card>

              <View style={styles.actionButtons}>
                <Button
                  variant="secondary"
                  icon="download"
                  onPress={handleSaveImage}
                  style={styles.actionButton}
                >
                  Als Bild speichern
                </Button>
                <Button
                  variant="secondary"
                  icon="share-2"
                  onPress={handleShare}
                  style={styles.actionButton}
                >
                  Teilen
                </Button>
                {isAdmin ? (
                  <Button
                    variant="danger"
                    icon="refresh-cw"
                    onPress={handleRegenerate}
                    loading={regenerateMutation.isPending}
                    style={styles.actionButton}
                  >
                    Neu generieren
                  </Button>
                ) : null}
              </View>
            </>
          ) : null}
        </ScrollView>
      </ThemedView>
    </Modal>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.header,
          { paddingTop: headerHeight + Spacing.sm, backgroundColor: theme.backgroundRoot },
        ]}
      >
        {renderTypeSelector()}
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Suchen..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : entities && entities.length > 0 ? (
        <FlatList
          data={entities}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderEntityItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
        />
      ) : (
        <EmptyState
          icon="grid"
          title="Keine Einträge gefunden"
          message={
            searchQuery
              ? "Versuchen Sie eine andere Suche."
              : `Keine ${getEntityTypeLabel(selectedType)} vorhanden.`
          }
        />
      )}

      {renderModal()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  typeSelector: {
    flexGrow: 0,
  },
  typeSelectorContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  typeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  searchContainer: {
    marginTop: Spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  entityCard: {
    marginBottom: Spacing.xs,
  },
  entityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  entityInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  qrPreview: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xs,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  qrContainer: {
    alignSelf: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  qrWrapper: {
    padding: Spacing.md,
  },
  qrLabel: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  metadataCard: {
    marginTop: Spacing.md,
  },
  metadataRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
    marginTop: Spacing.md,
  },
  metadataContent: {
    flex: 1,
  },
  actionButtons: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    width: "100%",
  },
});
