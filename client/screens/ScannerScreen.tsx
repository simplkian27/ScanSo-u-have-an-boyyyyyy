import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Pressable, Modal, ActivityIndicator, Platform, ScrollView, TextInput } from "react-native";
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
import { Task, CustomerContainer, WarehouseContainer, SCAN_CONTEXT_LABELS } from "@shared/schema";

type TaskScanMode = "pickup" | "delivery";
type AppMode = "info" | "task";

interface ScanResult {
  type: "customer" | "warehouse";
  container: CustomerContainer | WarehouseContainer;
}

interface TargetContainerInfo {
  id: string;
  label: string;
  location: string;
  content: string;
  materialType: string;
  capacity: number;
  currentFill: number;
  remainingCapacity: number;
  unit: string;
}

interface SourceContainerInfo {
  id: string;
  label: string;
  location: string;
  content: string;
  materialType: string;
  customerName: string;
  unit: string;
  currentQuantity: number;
  plannedPickupQuantity: number;
}

const OPEN_STATUSES = ["PLANNED", "ASSIGNED"];
const IN_PROGRESS_STATUSES = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
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
  const [targetContainerInfo, setTargetContainerInfo] = useState<TargetContainerInfo | null>(null);
  const [sourceContainerInfo, setSourceContainerInfo] = useState<SourceContainerInfo | null>(null);
  const [taskAccepted, setTaskAccepted] = useState(false);
  const [measuredWeight, setMeasuredWeight] = useState("");
  const [weightError, setWeightError] = useState<string | null>(null);
  const scanLock = useRef(false);

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const inProgressTask = tasks.find(
    (t) => IN_PROGRESS_STATUSES.includes(t.status) && t.assignedTo === user?.id
  );

  const taskScanMode: TaskScanMode = inProgressTask ? "delivery" : "pickup";

  const { data: targetWarehouseContainer } = useQuery<WarehouseContainer>({
    queryKey: ["/api/containers/warehouse", activeTask?.deliveryContainerID],
    enabled: !!activeTask?.deliveryContainerID,
  });

  const parseQRCode = (rawData: string): string => {
    try {
      const parsed = JSON.parse(rawData);
      if (parsed.qrCode) return parsed.qrCode;
      if (parsed.id) return parsed.id;
      if (parsed.code) return parsed.code;
      return rawData;
    } catch {
      return rawData;
    }
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanLock.current || isProcessing) return;
    scanLock.current = true;

    const qrCode = parseQRCode(result.data);
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
            (t) => t.containerID === container.id && OPEN_STATUSES.includes(t.status) && t.assignedTo === user?.id
          );
          if (relatedTask) {
            setActiveTask(relatedTask);
          } else {
            const hasAnyTaskForContainer = tasks.some(
              (t) => t.containerID === container.id && t.assignedTo === user?.id && (OPEN_STATUSES.includes(t.status) || IN_PROGRESS_STATUSES.includes(t.status))
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

  // Accept task - first step when scanning customer container
  const acceptTask = async () => {
    if (!activeTask || !user) return;
    setIsProcessing(true);
    setError(null);

    try {
      const location = await getLocation();
      const response = await apiRequest("POST", `/api/tasks/${activeTask.id}/accept`, {
        userId: user.id,
        location: location ? `${location.lat},${location.lng}` : undefined,
        geoLocation: location,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Auftragsannahme fehlgeschlagen.");
        scanLock.current = false;
        setIsProcessing(false);
        return;
      }

      const data = await response.json();
      
      // Update task state from response
      setActiveTask(data.task);
      setTaskAccepted(true);
      
      // Store source and target container info from response
      if (data.sourceContainer) {
        setSourceContainerInfo(data.sourceContainer);
      }
      if (data.targetContainer) {
        setTargetContainerInfo(data.targetContainer);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess("Auftrag angenommen! Sie können nun die Abholung bestätigen.");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/overview"] });
      
    } catch (err) {
      setError("Auftragsannahme fehlgeschlagen. Bitte erneut versuchen.");
      scanLock.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm pickup - second step after accepting
  const confirmPickup = async () => {
    if (!activeTask || !user) return;
    setIsProcessing(true);
    setError(null);

    try {
      const location = await getLocation();
      const response = await apiRequest("POST", `/api/tasks/${activeTask.id}/pickup`, {
        userId: user.id,
        location: location ? `${location.lat},${location.lng}` : undefined,
        geoLocation: location,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Abholungsbestätigung fehlgeschlagen.");
        scanLock.current = false;
        setIsProcessing(false);
        return;
      }

      setSuccess("Abholung bestätigt! Container ist jetzt unterwegs.");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/overview"] });
      
      setTimeout(() => {
        setScanResult(null);
        setActiveTask(null);
        setSuccess(null);
        setTaskAccepted(false);
        setTargetContainerInfo(null);
        setSourceContainerInfo(null);
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
    
    const weight = parseFloat(measuredWeight);
    if (isNaN(weight) || weight <= 0) {
      setWeightError("Bitte geben Sie ein gültiges Gewicht ein (> 0 kg)");
      return;
    }
    setWeightError(null);
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

    if (weight > availableSpace) {
      setError(`Kapazität unzureichend! Nur ${availableSpace.toFixed(0)}kg verfügbar, aber ${weight}kg eingegeben.`);
      setIsProcessing(false);
      scanLock.current = false;
      return;
    }

    try {
      const location = await getLocation();
      await apiRequest("POST", `/api/tasks/${activeTask.id}/delivery`, {
        userId: user.id,
        warehouseContainerId: warehouseContainer.id,
        amount: weight,
        measuredWeight: weight,
        location,
        scanContext: "TASK_COMPLETE_AT_WAREHOUSE",
      });

      setSuccess(`Lieferung bestätigt! ${weight} kg erfasst. Aufgabe abgeschlossen.`);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/overview"] });
      
      setTimeout(() => {
        setScanResult(null);
        setActiveTask(null);
        setSuccess(null);
        setMeasuredWeight("");
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
    setTaskAccepted(false);
    setTargetContainerInfo(null);
    setSourceContainerInfo(null);
    setMeasuredWeight("");
    setWeightError(null);
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
              status={container.isActive ? "active" : "inactive"} 
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

              {activeTask.plannedQuantity || activeTask.estimatedAmount ? (
                <View style={styles.taskInfoItem}>
                  <View style={styles.taskInfoLabelRow}>
                    <Feather name="database" size={14} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Geschätzte Menge
                    </ThemedText>
                  </View>
                  <ThemedText type="body">{activeTask.plannedQuantity || activeTask.estimatedAmount} {activeTask.plannedQuantityUnit || "kg"}</ThemedText>
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
                  status={activeTask.priority === "urgent" ? "critical" : activeTask.priority === "high" ? "warning" : "success"} 
                  size="small"
                  label={activeTask.priority === "urgent" ? "Dringend" : activeTask.priority === "high" ? "Hoch" : "Normal"}
                />
              </View>
            </View>
          </Card>
        ) : null}

        {scanResult.type === "customer" && (targetContainerInfo || (activeTask?.deliveryContainerID && targetWarehouseContainer)) ? (
          <Card style={{ ...styles.targetWarehouseCard, backgroundColor: theme.infoLight }}>
            <View style={styles.targetWarehouseHeader}>
              <View style={[styles.targetWarehouseIconContainer, { backgroundColor: theme.info }]}>
                <Feather name="truck" size={20} color={theme.textOnPrimary} />
              </View>
              <ThemedText type="bodyBold" style={{ color: theme.info }}>
                Zielcontainer im Lager
              </ThemedText>
            </View>
            
            <View style={styles.targetWarehouseContent}>
              <View style={styles.targetContainerInfo}>
                <Feather name="package" size={16} color={theme.primary} />
                <ThemedText type="bodyBold" style={{ color: theme.primary }}>
                  {targetContainerInfo?.id || targetWarehouseContainer?.id}
                </ThemedText>
              </View>
              
              <View style={styles.targetContainerInfo}>
                <Feather name="map-pin" size={16} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.text }}>
                  {targetContainerInfo?.location || targetWarehouseContainer?.location}
                </ThemedText>
              </View>

              {targetContainerInfo ? (
                <>
                  <View style={[styles.divider, { backgroundColor: theme.divider, marginVertical: Spacing.sm }]} />
                  
                  <View style={styles.targetContainerStats}>
                    <View style={styles.targetStatItem}>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        Material
                      </ThemedText>
                      <ThemedText type="bodyBold" style={{ color: theme.text }}>
                        {targetContainerInfo.content || targetContainerInfo.materialType}
                      </ThemedText>
                    </View>
                    
                    <View style={styles.targetStatItem}>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        Kapazität
                      </ThemedText>
                      <ThemedText type="bodyBold" style={{ color: theme.text }}>
                        {targetContainerInfo.capacity} {targetContainerInfo.unit}
                      </ThemedText>
                    </View>
                    
                    <View style={styles.targetStatItem}>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        Aktueller Füllstand
                      </ThemedText>
                      <ThemedText type="bodyBold" style={{ color: theme.text }}>
                        {targetContainerInfo.currentFill.toFixed(0)} {targetContainerInfo.unit}
                      </ThemedText>
                    </View>
                    
                    <View style={styles.targetStatItem}>
                      <ThemedText type="small" style={{ color: theme.success }}>
                        Restkapazität
                      </ThemedText>
                      <ThemedText type="bodyBold" style={{ color: theme.success }}>
                        {targetContainerInfo.remainingCapacity.toFixed(0)} {targetContainerInfo.unit}
                      </ThemedText>
                    </View>
                  </View>
                </>
              ) : null}
            </View>
          </Card>
        ) : null}

        {success ? (
          <View style={[styles.successBanner, { backgroundColor: theme.successLight }]}>
            <Feather name="check-circle" size={20} color={theme.success} />
            <ThemedText type="small" style={[styles.successText, { color: theme.success }]}>
              {success}
            </ThemedText>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.errorLight }]}>
            <Feather name="alert-circle" size={20} color={theme.error} />
            <ThemedText type="small" style={[styles.errorText, { color: theme.error }]}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        {scanResult.type === "warehouse" && activeTask && !hasValidationError ? (
          <Card style={[styles.weightInputCard, { backgroundColor: theme.cardSurface }]}>
            <ThemedText type="bodyBold" style={{ marginBottom: Spacing.sm }}>
              Gemessenes Gewicht
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              Bitte geben Sie das tatsächlich gemessene Gewicht ein:
            </ThemedText>
            <View style={[styles.weightInputContainer, { backgroundColor: theme.backgroundSecondary, borderColor: weightError ? theme.error : theme.border }]}>
              <Feather name="package" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.weightInput, { color: theme.text }]}
                value={measuredWeight}
                onChangeText={(text) => {
                  setMeasuredWeight(text);
                  setWeightError(null);
                }}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
              <ThemedText type="body" style={{ color: theme.textSecondary }}>kg</ThemedText>
            </View>
            {weightError ? (
              <ThemedText type="small" style={{ color: theme.error, marginTop: Spacing.xs }}>
                {weightError}
              </ThemedText>
            ) : null}
          </Card>
        ) : null}

        <View style={styles.modalActions}>
          <Button onPress={closeModal} style={[styles.cancelButton, { backgroundColor: theme.backgroundSecondary }]}>
            Abbrechen
          </Button>
          {scanResult.type === "customer" && activeTask && !hasValidationError ? (
            OPEN_STATUSES.includes(activeTask.status) && !taskAccepted ? (
              <Button
                onPress={acceptTask}
                disabled={isProcessing}
                style={[styles.confirmButton, { backgroundColor: theme.primary }]}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={theme.textOnPrimary} />
                ) : (
                  "Auftrag annehmen"
                )}
              </Button>
            ) : (activeTask.status === "ACCEPTED" || taskAccepted) ? (
              <Button
                onPress={confirmPickup}
                disabled={isProcessing}
                style={[styles.confirmButton, { backgroundColor: theme.accent }]}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={theme.textOnPrimary} />
                ) : (
                  "Abholung bestätigen"
                )}
              </Button>
            ) : null
          ) : scanResult.type === "warehouse" && activeTask && !hasValidationError ? (
            <Button
              onPress={confirmDelivery}
              disabled={isProcessing || !measuredWeight}
              style={[styles.confirmButton, { backgroundColor: theme.accent }]}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={theme.textOnPrimary} />
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
              <Feather name="info" size={18} color={appMode === "info" ? theme.textOnPrimary : theme.textSecondary} />
              <ThemedText
                type="smallBold"
                style={{ color: appMode === "info" ? theme.textOnPrimary : theme.textSecondary }}
              >
                Info
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.segmentButton,
                appMode === "task" && { backgroundColor: theme.accent },
              ]}
              onPress={() => setAppMode("task")}
            >
              <Feather name="clipboard" size={18} color={appMode === "task" ? theme.textOnPrimary : theme.textSecondary} />
              <ThemedText
                type="smallBold"
                style={{ color: appMode === "task" ? theme.textOnPrimary : theme.textSecondary }}
              >
                Aufgabe
              </ThemedText>
            </Pressable>
          </View>

          <Pressable
            style={[styles.flashButton, { backgroundColor: flashOn ? theme.accent : "rgba(0,0,0,0.6)" }]}
            onPress={() => setFlashOn(!flashOn)}
          >
            <Feather name={flashOn ? "zap" : "zap-off"} size={20} color={theme.textOnPrimary} />
          </Pressable>
        </View>

        <View style={styles.scanArea}>
          <View style={styles.scanFrame}>
            <View style={[styles.cornerTopLeft, { borderColor: theme.accent }]} />
            <View style={[styles.cornerTopRight, { borderColor: theme.accent }]} />
            <View style={[styles.cornerBottomLeft, { borderColor: theme.accent }]} />
            <View style={[styles.cornerBottomRight, { borderColor: theme.accent }]} />
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={[styles.modeIndicator, { backgroundColor: "rgba(0,0,0,0.7)" }]}>
            <Feather name={getModeIcon() as any} size={20} color={appMode === "info" ? theme.info : theme.accent} />
            <ThemedText type="bodyBold" style={{ color: theme.textOnPrimary, marginLeft: Spacing.sm }}>
              {getModeDisplayText()}
            </ThemedText>
          </View>
          {inProgressTask ? (
            <View style={[styles.activeTaskBanner, { backgroundColor: `${theme.statusInProgress}20` }]}>
              <Feather name="truck" size={16} color={theme.statusInProgress} />
              <ThemedText type="small" style={{ color: theme.statusInProgress, marginLeft: Spacing.xs }}>
                Aufgabe läuft - scannen Sie den Zielcontainer
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      <Modal
        visible={!!scanResult}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardSurface }]}>
            {success ? (
              <View style={styles.successContainer}>
                <View style={[styles.successIcon, { backgroundColor: `${theme.success}20` }]}>
                  <Feather name="check-circle" size={48} color={theme.success} />
                </View>
                <ThemedText type="h3" style={{ textAlign: "center", marginTop: Spacing.lg }}>
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
  },
  permissionContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  permissionContent: {
    alignItems: "center",
    padding: Spacing["3xl"],
  },
  permissionTitle: {
    marginTop: Spacing.xl,
    textAlign: "center",
  },
  permissionText: {
    marginTop: Spacing.md,
    textAlign: "center",
  },
  permissionButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing["3xl"],
  },
  permissionHint: {
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  segmentButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  flashButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 280,
    height: 280,
    position: "relative",
  },
  cornerTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 12,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    gap: Spacing.md,
  },
  modeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  activeTaskBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    maxHeight: "85%",
  },
  modalScrollView: {
    maxHeight: "100%",
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
    marginBottom: Spacing.md,
  },
  containerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  infoGrid: {
    gap: Spacing.md,
  },
  infoRow: {
    gap: Spacing.md,
  },
  infoItem: {
    gap: Spacing.xs,
  },
  infoLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  containerDetails: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  detailItem: {
    gap: 2,
  },
  taskInfoCard: {
    marginBottom: Spacing.md,
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
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  targetWarehouseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  targetWarehouseIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  targetWarehouseContent: {
    gap: Spacing.xs,
  },
  targetContainerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  targetContainerStats: {
    gap: Spacing.sm,
  },
  targetStatItem: {
    gap: 2,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  successText: {
    flex: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
  },
  modalActions: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  cancelButton: {
    paddingVertical: Spacing.md,
  },
  confirmButton: {
    paddingVertical: Spacing.lg,
  },
  closeButtonFull: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  noTaskText: {
    textAlign: "center",
    paddingVertical: Spacing.md,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  weightInputCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  weightInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  weightInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
  },
});
