import React, { useState, useRef } from "react";
import { View, StyleSheet, Pressable, Modal, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Task, CustomerContainer, WarehouseContainer } from "@shared/schema";

type ScanMode = "pickup" | "delivery";

interface ScanResult {
  type: "customer" | "warehouse";
  container: CustomerContainer | WarehouseContainer;
}

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashOn, setFlashOn] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const scanLock = useRef(false);

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const inProgressTask = tasks.find(
    (t) => t.status === "in_progress" && t.assignedTo === user?.id
  );

  const scanMode: ScanMode = inProgressTask ? "delivery" : "pickup";

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanLock.current || isProcessing) return;
    scanLock.current = true;

    const qrCode = result.data;
    setIsProcessing(true);
    setError(null);

    try {
      let response = await fetch(
        `${process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : ""}/api/containers/customer/qr/${encodeURIComponent(qrCode)}`
      );

      if (response.ok) {
        const container = await response.json();
        setScanResult({ type: "customer", container });
        
        const relatedTask = tasks.find(
          (t) => t.containerID === container.id && t.status === "open" && t.assignedTo === user?.id
        );
        if (relatedTask) {
          setActiveTask(relatedTask);
        }
      } else {
        response = await fetch(
          `${process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : ""}/api/containers/warehouse/qr/${encodeURIComponent(qrCode)}`
        );

        if (response.ok) {
          const container = await response.json();
          setScanResult({ type: "warehouse", container });
          if (inProgressTask) {
            setActiveTask(inProgressTask);
          }
        } else {
          setError("Container nicht gefunden. Bitte scannen Sie einen gültigen QR-Code.");
        }
      }
    } catch (err) {
      setError("Container-Scan fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return null;
      }
      const location = await Location.getCurrentPositionAsync({});
      return { lat: location.coords.latitude, lng: location.coords.longitude };
    } catch {
      return null;
    }
  };

  const confirmPickup = async () => {
    if (!activeTask || !user) return;
    setIsProcessing(true);
    setError(null);

    try {
      const location = await getLocation();
      await apiRequest("POST", `/api/tasks/${activeTask.id}/pickup`, {
        userId: user.id,
        location,
      });

      setSuccess("Abholung bestätigt! Container ist jetzt unterwegs.");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      
      setTimeout(() => {
        setScanResult(null);
        setActiveTask(null);
        setSuccess(null);
        scanLock.current = false;
      }, 2000);
    } catch (err) {
      setError("Abholungsbestätigung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDelivery = async () => {
    if (!activeTask || !user || !scanResult || scanResult.type !== "warehouse") return;
    setIsProcessing(true);
    setError(null);

    const warehouseContainer = scanResult.container as WarehouseContainer;

    if (warehouseContainer.materialType !== activeTask.materialType) {
      setError(`Materialkonflikt! Container akzeptiert ${warehouseContainer.materialType}, aber Aufgabenmaterial ist ${activeTask.materialType}.`);
      setIsProcessing(false);
      return;
    }

    const availableSpace = warehouseContainer.maxCapacity - warehouseContainer.currentAmount;
    const estimatedAmount = activeTask.estimatedAmount || 0;

    if (estimatedAmount > availableSpace) {
      setError(`Kapazität unzureichend! Nur ${availableSpace.toFixed(0)}kg verfügbar, aber ${estimatedAmount}kg benötigt.`);
      setIsProcessing(false);
      return;
    }

    try {
      const location = await getLocation();
      await apiRequest("POST", `/api/tasks/${activeTask.id}/delivery`, {
        userId: user.id,
        warehouseContainerId: warehouseContainer.id,
        amount: estimatedAmount,
        location,
      });

      setSuccess("Lieferung bestätigt! Aufgabe abgeschlossen.");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/warehouse"] });
      
      setTimeout(() => {
        setScanResult(null);
        setActiveTask(null);
        setSuccess(null);
        scanLock.current = false;
      }, 2000);
    } catch (err) {
      setError("Lieferungsbestätigung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setScanResult(null);
    setActiveTask(null);
    setError(null);
    setSuccess(null);
    scanLock.current = false;
  };

  if (!permission) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={[styles.container, styles.permissionContainer]}>
        <View style={styles.permissionContent}>
          <Feather name="camera-off" size={64} color={Colors.light.textSecondary} />
          <ThemedText type="h4" style={styles.permissionTitle}>
            Kamerazugriff erforderlich
          </ThemedText>
          <ThemedText type="body" style={styles.permissionText}>
            ContainerFlow benötigt Kamerazugriff zum Scannen von QR-Codes auf Containern.
          </ThemedText>
          <Button onPress={requestPermission} style={styles.permissionButton}>
            Kamera aktivieren
          </Button>
          {permission.status === "denied" && !permission.canAskAgain && Platform.OS !== "web" ? (
            <ThemedText type="small" style={styles.permissionHint}>
              Bitte aktivieren Sie den Kamerazugriff in Ihren Geräteeinstellungen.
            </ThemedText>
          ) : null}
        </View>
      </ThemedView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={flashOn}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanResult ? undefined : handleBarCodeScanned}
      />

      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.modeIndicator}>
            <Feather
              name={scanMode === "pickup" ? "log-in" : "log-out"}
              size={20}
              color="#FFFFFF"
            />
            <ThemedText type="body" style={styles.modeText}>
              {scanMode === "pickup" ? "Scannen für Abholung" : "Scannen für Lieferung"}
            </ThemedText>
          </View>
        </View>

        <View style={styles.scannerFrame}>
          <View style={styles.corner} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing["5xl"] }]}>
          {inProgressTask ? (
            <View style={styles.activeTaskBanner}>
              <Feather name="truck" size={20} color={Colors.light.statusInProgress} />
              <ThemedText type="small" style={styles.activeTaskText}>
                Unterwegs: {inProgressTask.containerID}
              </ThemedText>
            </View>
          ) : null}

          <Pressable
            style={[styles.flashButton, flashOn && styles.flashButtonActive]}
            onPress={() => setFlashOn(!flashOn)}
          >
            <Feather
              name={flashOn ? "zap" : "zap-off"}
              size={24}
              color={flashOn ? Colors.light.accent : "#FFFFFF"}
            />
          </Pressable>
        </View>
      </View>

      <Modal
        visible={!!scanResult}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
            {success ? (
              <View style={styles.successState}>
                <Feather name="check-circle" size={64} color={Colors.light.success} />
                <ThemedText type="h4" style={styles.successText}>
                  {success}
                </ThemedText>
              </View>
            ) : scanResult ? (
              <>
                <View style={styles.modalHeader}>
                  <ThemedText type="h3">
                    {scanResult.type === "customer" ? "Kundencontainer" : "Lagercontainer"}
                  </ThemedText>
                  <Pressable onPress={closeModal} style={styles.closeButton}>
                    <Feather name="x" size={24} color={Colors.light.text} />
                  </Pressable>
                </View>

                <Card style={styles.containerCard}>
                  <View style={styles.containerHeader}>
                    <Feather name="package" size={32} color={Colors.light.primary} />
                    <View>
                      <ThemedText type="h4">{scanResult.container.id}</ThemedText>
                      <ThemedText type="small" style={styles.containerLocation}>
                        {scanResult.container.location}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.containerDetails}>
                    <View style={styles.detailItem}>
                      <ThemedText type="small" style={styles.detailLabel}>Material</ThemedText>
                      <ThemedText type="body">{scanResult.container.materialType}</ThemedText>
                    </View>

                    {scanResult.type === "warehouse" ? (
                      <View style={styles.detailItem}>
                        <ThemedText type="small" style={styles.detailLabel}>Kapazität</ThemedText>
                        <ThemedText type="body">
                          {(scanResult.container as WarehouseContainer).currentAmount.toFixed(0)} / {(scanResult.container as WarehouseContainer).maxCapacity} kg
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </Card>

                {error ? (
                  <View style={styles.errorBanner}>
                    <Feather name="alert-circle" size={20} color={Colors.light.error} />
                    <ThemedText type="small" style={styles.errorText}>
                      {error}
                    </ThemedText>
                  </View>
                ) : null}

                <View style={styles.modalActions}>
                  <Button onPress={closeModal} style={styles.cancelButton}>
                    Abbrechen
                  </Button>
                  {scanResult.type === "customer" && activeTask ? (
                    <Button
                      onPress={confirmPickup}
                      disabled={isProcessing}
                      style={styles.confirmButton}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        "Abholung bestätigen"
                      )}
                    </Button>
                  ) : scanResult.type === "warehouse" && activeTask ? (
                    <Button
                      onPress={confirmDelivery}
                      disabled={isProcessing}
                      style={styles.confirmButton}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        "Lieferung bestätigen"
                      )}
                    </Button>
                  ) : (
                    <ThemedText type="small" style={styles.noTaskText}>
                      Keine aktive Aufgabe für diesen Container
                    </ThemedText>
                  )}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  permissionContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundRoot,
  },
  permissionContent: {
    alignItems: "center",
    padding: Spacing["2xl"],
    gap: Spacing.md,
  },
  permissionTitle: {
    textAlign: "center",
    marginTop: Spacing.lg,
  },
  permissionText: {
    textAlign: "center",
    color: Colors.light.textSecondary,
  },
  permissionButton: {
    backgroundColor: Colors.light.accent,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
  },
  permissionHint: {
    textAlign: "center",
    color: Colors.light.textSecondary,
    marginTop: Spacing.md,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  header: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  modeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  modeText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scannerFrame: {
    width: 250,
    height: 250,
    alignSelf: "center",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: Colors.light.accent,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    right: 0,
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    borderTopWidth: 0,
    borderBottomWidth: 4,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    right: 0,
    bottom: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 8,
  },
  footer: {
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.lg,
  },
  activeTaskBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  activeTaskText: {
    color: "#FFFFFF",
  },
  flashButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  flashButtonActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: Colors.light.backgroundRoot,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  containerCard: {
    backgroundColor: Colors.light.backgroundDefault,
    marginBottom: Spacing.lg,
  },
  containerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  containerLocation: {
    color: Colors.light.textSecondary,
  },
  containerDetails: {
    gap: Spacing.md,
  },
  detailItem: {
    gap: 2,
  },
  detailLabel: {
    color: Colors.light.textSecondary,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#FFEBEE",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: Colors.light.error,
    flex: 1,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.light.accent,
  },
  noTaskText: {
    flex: 1,
    textAlign: "center",
    color: Colors.light.textSecondary,
    alignSelf: "center",
  },
  successState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.lg,
  },
  successText: {
    textAlign: "center",
    color: Colors.light.success,
  },
});
