import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Pressable, Modal, ActivityIndicator, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Task, CustomerContainer, WarehouseContainer } from "@shared/schema";

type TaskScanMode = "pickup" | "delivery";
type AppMode = "info" | "task";

interface ScanResult {
  type: "customer" | "warehouse";
  container: CustomerContainer | WarehouseContainer;
}

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashOn, setFlashOn] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>("task");
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

  const taskScanMode: TaskScanMode = inProgressTask ? "delivery" : "pickup";

  const { data: targetWarehouseContainer } = useQuery<WarehouseContainer>({
    queryKey: ["/api/containers/warehouse", activeTask?.deliveryContainerID],
    enabled: !!activeTask?.deliveryContainerID,
  });

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanLock.current || isProcessing) return;
    scanLock.current = true;

    const qrCode = result.data;
    setIsProcessing(true);
    setError(null);

    try {
      let response = await apiRequest("GET", `/api/containers/customer/qr/${encodeURIComponent(qrCode)}`);

      if (response.ok) {
        const container = await response.json();
        
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        setScanResult({ type: "customer", container });
        
        if (appMode === "task") {
          const relatedTask = tasks.find(
            (t) => t.containerID === container.id && t.status === "open" && t.assignedTo === user?.id
          );
          if (relatedTask) {
            setActiveTask(relatedTask);
          } else {
            const hasAnyTaskForContainer = tasks.some(
              (t) => t.containerID === container.id && t.assignedTo === user?.id && (t.status === "open" || t.status === "in_progress")
            );
            if (!hasAnyTaskForContainer) {
              setError("Dieser Container gehört nicht zu Ihren Aufgaben.");
            }
          }
        }
      } else {
        response = await apiRequest("GET", `/api/containers/warehouse/qr/${encodeURIComponent(qrCode)}`);

        if (response.ok) {
          const container = await response.json();
          
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          setScanResult({ type: "warehouse", container });
          if (appMode === "task" && inProgressTask) {
            setActiveTask(inProgressTask);
            if (inProgressTask.deliveryContainerID && inProgressTask.deliveryContainerID !== container.id) {
              setError(`Dies ist nicht der Zielcontainer. Bitte scannen Sie Container ${inProgressTask.deliveryContainerID}.`);
            }
          }
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError("Container nicht gefunden. Bitte scannen Sie einen gültigen QR-Code.");
          scanLock.current = false;
        }
      }
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Container-Scan fehlgeschlagen. Bitte erneut versuchen.");
      scanLock.current = false;
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
      scanLock.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDelivery = async () => {
    if (!activeTask || !user || !scanResult || scanResult.type !== "warehouse") return;
    setIsProcessing(true);
    setError(null);

    const warehouseContainer = scanResult.container as WarehouseContainer;

    if (activeTask.deliveryContainerID && activeTask.deliveryContainerID !== warehouseContainer.id) {
      setError(`Dies ist nicht der Zielcontainer. Bitte scannen Sie Container ${activeTask.deliveryContainerID}.`);
      setIsProcessing(false);
      scanLock.current = false;
      return;
    }

    if (warehouseContainer.materialType !== activeTask.materialType) {
      setError(`Materialkonflikt! Container akzeptiert ${warehouseContainer.materialType}, aber Aufgabenmaterial ist ${activeTask.materialType}.`);
      setIsProcessing(false);
      scanLock.current = false;
      return;
    }

    const availableSpace = warehouseContainer.maxCapacity - warehouseContainer.currentAmount;
    const estimatedAmount = activeTask.estimatedAmount || 0;

    if (estimatedAmount > availableSpace) {
      setError(`Kapazität unzureichend! Nur ${availableSpace.toFixed(0)}kg verfügbar, aber ${estimatedAmount}kg benötigt.`);
      setIsProcessing(false);
      scanLock.current = false;
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
      scanLock.current = false;
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

  const toggleAppMode = () => {
    setAppMode(appMode === "info" ? "task" : "info");
  };

  const getModeDisplayText = () => {
    if (appMode === "info") {
      return "Info-Modus";
    }
    return taskScanMode === "pickup" ? "Scannen für Abholung" : "Scannen für Lieferung";
  };

  const getModeIcon = () => {
    if (appMode === "info") {
      return "info";
    }
    return taskScanMode === "pickup" ? "log-in" : "log-out";
  };

  const renderInfoModeContent = () => {
    if (!scanResult) return null;

    const isWarehouse = scanResult.type === "warehouse";
    const container = scanResult.container;
    const warehouseContainer = isWarehouse ? container as WarehouseContainer : null;
    const customerContainer = !isWarehouse ? container as CustomerContainer : null;

    return (
      <>
        <View style={styles.modalHeader}>
          <ThemedText type="h3">
            Container-Information
          </ThemedText>
          <Pressable onPress={closeModal} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>

        <Card style={{ ...styles.containerCard, backgroundColor: theme.backgroundSecondary }}>
          <View style={styles.containerHeader}>
            <Feather name="package" size={32} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <ThemedText type="h4">{container.id}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {isWarehouse ? "Lagercontainer" : "Kundencontainer"}
              </ThemedText>
            </View>
            <StatusBadge 
              status={container.isActive ? "completed" : "cancelled"} 
              size="small"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <View style={styles.infoLabelRow}>
                  <Feather name="box" size={16} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Was ist drin?
                  </ThemedText>
                </View>
                <ThemedText type="bodyBold">{container.materialType}</ThemedText>
              </View>
            </View>

            {warehouseContainer ? (
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <View style={styles.infoLabelRow}>
                    <Feather name="database" size={16} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Menge
                    </ThemedText>
                  </View>
                  <ThemedText type="bodyBold">
                    {warehouseContainer.currentAmount.toFixed(0)} / {warehouseContainer.maxCapacity} kg
                  </ThemedText>
                </View>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <View style={styles.infoLabelRow}>
                  <Feather name="map-pin" size={16} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Standort
                  </ThemedText>
                </View>
                <ThemedText type="bodyBold">{container.location}</ThemedText>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <View style={styles.infoLabelRow}>
                  <Feather name="activity" size={16} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Status
                  </ThemedText>
                </View>
                <ThemedText type="bodyBold" style={{ color: container.isActive ? theme.success : theme.error }}>
                  {container.isActive ? "Aktiv" : "Inaktiv"}
                </ThemedText>
              </View>
            </View>

            {customerContainer?.customerName ? (
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <View style={styles.infoLabelRow}>
                    <Feather name="user" size={16} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Kunde
                    </ThemedText>
                  </View>
                  <ThemedText type="bodyBold">{customerContainer.customerName}</ThemedText>
                </View>
              </View>
            ) : null}
          </View>
        </Card>

        <Button onPress={closeModal} style={[styles.closeButtonFull, { backgroundColor: theme.accent }]}>
          Schließen
        </Button>
      </>
    );
  };

  const formatScheduledTime = (date: Date | string | null | undefined) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderTaskModeContent = () => {
    if (!scanResult) return null;

    const hasValidationError = !!error;
    const canConfirmPickup = scanResult.type === "customer" && activeTask && !hasValidationError;
    const canConfirmDelivery = scanResult.type === "warehouse" && activeTask && !hasValidationError;

    return (
      <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.modalHeader}>
          <ThemedText type="h3">
            {scanResult.type === "customer" ? "Kundencontainer" : "Lagercontainer"}
          </ThemedText>
          <Pressable onPress={closeModal} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>

        <Card style={{ ...styles.containerCard, backgroundColor: theme.backgroundSecondary }}>
          <View style={styles.containerHeader}>
            <Feather name="package" size={32} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <ThemedText type="h4">{scanResult.container.id}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {scanResult.container.location}
              </ThemedText>
            </View>
          </View>

          <View style={styles.containerDetails}>
            <View style={styles.detailItem}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Material</ThemedText>
              <ThemedText type="body">{scanResult.container.materialType}</ThemedText>
            </View>

            {scanResult.type === "warehouse" ? (
              <View style={styles.detailItem}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Kapazität</ThemedText>
                <ThemedText type="body">
                  {(scanResult.container as WarehouseContainer).currentAmount.toFixed(0)} / {(scanResult.container as WarehouseContainer).maxCapacity} kg
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Card>

        {scanResult.type === "customer" && activeTask ? (
          <Card style={{ ...styles.taskInfoCard, backgroundColor: theme.backgroundSecondary }}>
            <View style={styles.taskInfoHeader}>
              <Feather name="clipboard" size={20} color={theme.primary} />
              <ThemedText type="bodyBold">Aufgabendetails</ThemedText>
            </View>
            
            <View style={styles.taskInfoGrid}>
              {activeTask.scheduledTime ? (
                <View style={styles.taskInfoItem}>
                  <View style={styles.taskInfoLabelRow}>
                    <Feather name="clock" size={14} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Geplante Zeit
                    </ThemedText>
                  </View>
                  <ThemedText type="body">{formatScheduledTime(activeTask.scheduledTime)}</ThemedText>
                </View>
              ) : null}

              {activeTask.estimatedAmount ? (
                <View style={styles.taskInfoItem}>
                  <View style={styles.taskInfoLabelRow}>
                    <Feather name="database" size={14} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Geschätzte Menge
                    </ThemedText>
                  </View>
                  <ThemedText type="body">{activeTask.estimatedAmount} kg</ThemedText>
                </View>
              ) : null}

              <View style={styles.taskInfoItem}>
                <View style={styles.taskInfoLabelRow}>
                  <Feather name="tag" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Priorität
                  </ThemedText>
                </View>
                <StatusBadge 
                  status={activeTask.priority === "urgent" ? "cancelled" : activeTask.priority === "high" ? "in_progress" : "open"} 
                  size="small"
                  label={activeTask.priority === "urgent" ? "Dringend" : activeTask.priority === "high" ? "Hoch" : "Normal"}
                />
              </View>
            </View>
          </Card>
        ) : null}

        {scanResult.type === "customer" && activeTask?.deliveryContainerID && targetWarehouseContainer ? (
          <Card style={{ ...styles.targetWarehouseCard, backgroundColor: theme.infoLight }}>
            <View style={styles.targetWarehouseHeader}>
              <View style={[styles.targetWarehouseIconContainer, { backgroundColor: theme.info }]}>
                <Feather name="truck" size={20} color="#FFFFFF" />
              </View>
              <ThemedText type="bodyBold" style={{ color: theme.info }}>
                Ziel im Lager
              </ThemedText>
            </View>
            
            <View style={styles.targetWarehouseContent}>
              <ThemedText type="body" style={{ color: theme.text }}>
                Bring diesen Container zu:
              </ThemedText>
              <View style={styles.targetContainerInfo}>
                <Feather name="map-pin" size={16} color={theme.primary} />
                <ThemedText type="bodyBold" style={{ color: theme.primary }}>
                  {targetWarehouseContainer.id} - {targetWarehouseContainer.location}
                </ThemedText>
              </View>
            </View>
          </Card>
        ) : null}

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.errorLight }]}>
            <Feather name="alert-circle" size={20} color={theme.error} />
            <ThemedText type="small" style={[styles.errorText, { color: theme.error }]}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.modalActions}>
          <Button onPress={closeModal} style={[styles.cancelButton, { backgroundColor: theme.backgroundSecondary }]}>
            Abbrechen
          </Button>
          {canConfirmPickup ? (
            <Button
              onPress={confirmPickup}
              disabled={isProcessing}
              style={[styles.confirmButton, { backgroundColor: theme.accent }]}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                "Abholung bestätigen"
              )}
            </Button>
          ) : canConfirmDelivery ? (
            <Button
              onPress={confirmDelivery}
              disabled={isProcessing}
              style={[styles.confirmButton, { backgroundColor: theme.accent }]}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                "Lieferung bestätigen"
              )}
            </Button>
          ) : !activeTask ? (
            <ThemedText type="small" style={[styles.noTaskText, { color: theme.textSecondary }]}>
              Keine aktive Aufgabe für diesen Container
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>
    );
  };

  if (!permission) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={theme.accent} />
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={[styles.container, styles.permissionContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.permissionContent}>
          <Feather name="camera-off" size={64} color={theme.textSecondary} />
          <ThemedText type="h4" style={styles.permissionTitle}>
            Kamerazugriff erforderlich
          </ThemedText>
          <ThemedText type="body" style={[styles.permissionText, { color: theme.textSecondary }]}>
            ContainerFlow benötigt Kamerazugriff zum Scannen von QR-Codes auf Containern.
          </ThemedText>
          <Button onPress={requestPermission} style={[styles.permissionButton, { backgroundColor: theme.accent }]}>
            Kamera aktivieren
          </Button>
          {permission.status === "denied" && !permission.canAskAgain && Platform.OS !== "web" ? (
            <ThemedText type="small" style={[styles.permissionHint, { color: theme.textSecondary }]}>
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
          <View style={[styles.segmentedControl, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
            <Pressable
              style={[
                styles.segmentButton,
                appMode === "info" && { backgroundColor: theme.info },
              ]}
              onPress={() => setAppMode("info")}
            >
              <Feather name="info" size={18} color="#FFFFFF" />
              <ThemedText type="small" style={styles.segmentText}>Info</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.segmentButton,
                appMode === "task" && { backgroundColor: theme.accent },
              ]}
              onPress={() => setAppMode("task")}
            >
              <Feather name="clipboard" size={18} color="#FFFFFF" />
              <ThemedText type="small" style={styles.segmentText}>Aufgabe</ThemedText>
            </Pressable>
          </View>
          
          {appMode === "task" ? (
            <View style={[styles.scanModeIndicator, { backgroundColor: theme.accent }]}>
              <Feather name={taskScanMode === "pickup" ? "log-in" : "log-out"} size={14} color="#FFFFFF" />
              <ThemedText type="caption" style={styles.scanModeText}>
                {taskScanMode === "pickup" ? "Scannen für Abholung" : "Scannen für Lieferung"}
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.scanModeIndicator, { backgroundColor: theme.info }]}>
              <ThemedText type="caption" style={styles.scanModeText}>
                Nur Container-Information anzeigen
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.scannerFrame}>
          <View style={[styles.corner, { borderColor: theme.accent }]} />
          <View style={[styles.corner, styles.topRight, { borderColor: theme.accent }]} />
          <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.accent }]} />
          <View style={[styles.corner, styles.bottomRight, { borderColor: theme.accent }]} />
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing["5xl"] }]}>
          {appMode === "task" && inProgressTask ? (
            <View style={styles.activeTaskBanner}>
              <Feather name="truck" size={20} color={theme.statusInProgress} />
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
              color={flashOn ? theme.accent : "#FFFFFF"}
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
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.xl }]}>
            {success ? (
              <View style={styles.successState}>
                <Feather name="check-circle" size={64} color={theme.success} />
                <ThemedText type="h4" style={[styles.successText, { color: theme.success }]}>
                  {success}
                </ThemedText>
              </View>
            ) : appMode === "info" ? (
              renderInfoModeContent()
            ) : (
              renderTaskModeContent()
            )}
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
  },
  permissionButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
  },
  permissionHint: {
    textAlign: "center",
    marginTop: Spacing.md,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  header: {
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: BorderRadius.full,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  segmentText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scanModeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  scanModeText: {
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
    marginBottom: Spacing.lg,
  },
  containerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  infoGrid: {
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  infoItem: {
    flex: 1,
    gap: Spacing.xs,
  },
  infoLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  containerDetails: {
    gap: Spacing.md,
  },
  detailItem: {
    gap: 2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.lg,
  },
  errorText: {
    flex: 1,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
  closeButtonFull: {
    width: "100%",
  },
  noTaskText: {
    flex: 1,
    textAlign: "center",
    alignSelf: "center",
  },
  successState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.lg,
  },
  successText: {
    textAlign: "center",
  },
  modalScrollView: {
    flex: 1,
  },
  taskInfoCard: {
    marginBottom: Spacing.lg,
  },
  taskInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  taskInfoGrid: {
    gap: Spacing.md,
  },
  taskInfoItem: {
    gap: Spacing.xs,
  },
  taskInfoLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  targetWarehouseCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  targetWarehouseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  targetWarehouseIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  targetWarehouseContent: {
    gap: Spacing.sm,
  },
  targetContainerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
