import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { CustomerContainer, User, WarehouseContainer } from "@shared/schema";
import { ProgressBar } from "@/components/ProgressBar";

type UserWithoutPassword = Omit<User, "password">;

export default function CreateTaskScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [selectedWarehouseContainer, setSelectedWarehouseContainer] = useState<string>("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedWarehouseContainer("");
  }, [selectedContainer]);

  const { data: containers = [] } = useQuery<CustomerContainer[]>({
    queryKey: ["/api/containers/customer"],
  });

  const { data: users = [] } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
  });

  const { data: warehouseContainers = [] } = useQuery<WarehouseContainer[]>({
    queryKey: ["/api/containers/warehouse"],
  });

  const drivers = users.filter((u) => u.role === "driver" && u.isActive);
  const selectedContainerData = containers.find((c) => c.id === selectedContainer);
  
  const filteredWarehouseContainers = warehouseContainers.filter(
    (wc) => wc.isActive && selectedContainerData && wc.materialType === selectedContainerData.materialType
  );

  const handleSubmit = async () => {
    if (!selectedContainer || !selectedDriver) {
      setError("Bitte wählen Sie einen Container und Fahrer aus");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await apiRequest("POST", "/api/tasks", {
        containerID: selectedContainer,
        assignedTo: selectedDriver,
        materialType: selectedContainerData?.materialType || "Unknown",
        estimatedAmount: estimatedAmount ? parseFloat(estimatedAmount) : null,
        priority,
        notes: notes.trim() || null,
        createdBy: user?.id,
        scheduledTime: new Date().toISOString(),
        status: "open",
        deliveryContainerID: selectedWarehouseContainer || null,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aufgabe konnte nicht erstellt werden");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
      >
        <Card style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Container auswählen
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.containerList}
          >
            {containers.map((container) => (
              <Pressable
                key={container.id}
                style={[
                  styles.containerOption,
                  { backgroundColor: theme.backgroundSecondary },
                  selectedContainer === container.id && [styles.containerSelected, { backgroundColor: `${theme.accent}20`, borderColor: theme.accent }],
                ]}
                onPress={() => setSelectedContainer(container.id)}
              >
                <Feather
                  name="package"
                  size={24}
                  color={selectedContainer === container.id ? theme.accent : theme.textSecondary}
                />
                <ThemedText
                  type="body"
                  style={[
                    styles.containerOptionText,
                    selectedContainer === container.id && { color: theme.accent },
                  ]}
                >
                  {container.id}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>
                  {container.customerName}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
          {selectedContainerData ? (
            <View style={[styles.selectedInfo, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="info" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                {selectedContainerData.location} - {selectedContainerData.materialType}
              </ThemedText>
            </View>
          ) : null}
        </Card>

        <Card style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Fahrer zuweisen
          </ThemedText>
          <View style={styles.driverList}>
            {drivers.map((driver) => (
              <Pressable
                key={driver.id}
                style={[
                  styles.driverOption,
                  { backgroundColor: theme.backgroundSecondary },
                  selectedDriver === driver.id && { backgroundColor: `${theme.accent}20`, borderWidth: 2, borderColor: theme.accent },
                ]}
                onPress={() => setSelectedDriver(driver.id)}
              >
                <View
                  style={[
                    styles.driverAvatar,
                    { backgroundColor: theme.primary },
                    selectedDriver === driver.id && { backgroundColor: theme.accent },
                  ]}
                >
                  <ThemedText type="small" style={styles.driverInitials}>
                    {driver.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </ThemedText>
                </View>
                <ThemedText
                  type="body"
                  style={selectedDriver === driver.id ? { color: theme.accent, fontWeight: "600" } : undefined}
                >
                  {driver.name}
                </ThemedText>
                {selectedDriver === driver.id ? (
                  <Feather name="check" size={20} color={theme.accent} />
                ) : null}
              </Pressable>
            ))}
          </View>
          {drivers.length === 0 ? (
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", padding: Spacing.lg }}>
              Keine aktiven Fahrer verfügbar
            </ThemedText>
          ) : null}
        </Card>

        <Card style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Ziel-Container im Lager
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            Wählen Sie einen Lagercontainer für die Materiallieferung (optional)
          </ThemedText>
          {selectedContainerData ? (
            filteredWarehouseContainers.length > 0 ? (
              <View style={styles.warehouseList}>
                {filteredWarehouseContainers.map((wc) => {
                  const availableCapacity = wc.maxCapacity - wc.currentAmount;
                  const fillPercentage = Math.round((wc.currentAmount / wc.maxCapacity) * 100);
                  const isSelected = selectedWarehouseContainer === wc.id;
                  
                  return (
                    <Pressable
                      key={wc.id}
                      style={[
                        styles.warehouseOption,
                        { backgroundColor: theme.backgroundSecondary },
                        isSelected && { backgroundColor: `${theme.accent}20`, borderWidth: 2, borderColor: theme.accent },
                      ]}
                      onPress={() => setSelectedWarehouseContainer(isSelected ? "" : wc.id)}
                    >
                      <View style={styles.warehouseHeader}>
                        <View style={styles.warehouseIdRow}>
                          <Feather
                            name="inbox"
                            size={20}
                            color={isSelected ? theme.accent : theme.textSecondary}
                          />
                          <ThemedText
                            type="body"
                            style={[
                              styles.warehouseId,
                              isSelected && { color: theme.accent },
                            ]}
                          >
                            {wc.id}
                          </ThemedText>
                          {isSelected ? (
                            <Feather name="check-circle" size={20} color={theme.accent} />
                          ) : null}
                        </View>
                        <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 28, marginTop: Spacing.xs }}>
                          {wc.location}
                        </ThemedText>
                      </View>
                      <View style={[styles.warehouseCapacity, { borderTopColor: theme.borderLight }]}>
                        <View style={styles.capacityRow}>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            Verfügbar:
                          </ThemedText>
                          <ThemedText type="small" style={{ fontWeight: "600", color: theme.success }}>
                            {availableCapacity.toFixed(0)} kg
                          </ThemedText>
                        </View>
                        <View style={styles.progressContainer}>
                          <ProgressBar 
                            progress={fillPercentage} 
                            showFillColor={true}
                          />
                        </View>
                        <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
                          {fillPercentage}% belegt ({wc.currentAmount.toFixed(0)} / {wc.maxCapacity.toFixed(0)} kg)
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.noWarehouseContainer, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="alert-circle" size={20} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                  Keine passenden Lagercontainer für {selectedContainerData.materialType} verfügbar
                </ThemedText>
              </View>
            )
          ) : (
            <View style={[styles.noWarehouseContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="info" size={20} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                Bitte wählen Sie zuerst einen Kundencontainer aus
              </ThemedText>
            </View>
          )}
        </Card>

        <Card style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Aufgabendetails
          </ThemedText>

          <TextInput
            label="Geschätzte Menge (kg)"
            value={estimatedAmount}
            onChangeText={setEstimatedAmount}
            placeholder="z.B. 50"
            keyboardType="numeric"
          />

          <View style={styles.prioritySection}>
            <ThemedText type="small" style={{ fontWeight: "500", marginBottom: Spacing.xs }}>Priorität</ThemedText>
            <View style={styles.priorityOptions}>
              {(["normal", "high", "urgent"] as const).map((p) => (
                <Pressable
                  key={p}
                  style={[
                    styles.priorityOption,
                    { backgroundColor: theme.backgroundSecondary },
                    priority === p && { backgroundColor: `${theme.accent}20`, borderColor: theme.accent },
                    priority === p && p === "urgent" && { backgroundColor: `${theme.error}20`, borderColor: theme.error },
                    priority === p && p === "high" && { backgroundColor: `${theme.warning}20`, borderColor: theme.warning },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <ThemedText
                    type="small"
                    style={[
                      { color: theme.textSecondary },
                      priority === p && { fontWeight: "600" },
                    ]}
                  >
                    {p === "normal" ? "Normal" : p === "high" ? "Hoch" : "Dringend"}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <TextInput
            label="Notizen (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Abholungsanweisungen hinzufügen..."
            multiline
            numberOfLines={3}
            style={styles.notesInput}
          />
        </Card>

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.errorLight }]}>
            <Feather name="alert-circle" size={16} color={theme.error} />
            <ThemedText type="small" style={{ color: theme.error, flex: 1 }}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <Button
          style={[styles.submitButton, { backgroundColor: theme.accent }]}
          onPress={handleSubmit}
          disabled={isSubmitting || !selectedContainer || !selectedDriver}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.submitContent}>
              <Feather name="plus-circle" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={styles.submitText}>
                Aufgabe erstellen
              </ThemedText>
            </View>
          )}
        </Button>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  containerList: {
    marginHorizontal: -Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  containerOption: {
    alignItems: "center",
    padding: Spacing.md,
    marginRight: Spacing.md,
    borderRadius: BorderRadius.sm,
    minWidth: 100,
  },
  containerSelected: {
    borderWidth: 2,
  },
  containerOptionText: {
    marginTop: Spacing.xs,
    fontWeight: "600",
  },
  selectedInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  driverList: {
    gap: Spacing.sm,
  },
  driverOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  driverInitials: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  prioritySection: {
    marginTop: Spacing.sm,
  },
  priorityOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  notesInput: {
    height: 80,
    textAlignVertical: "top",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  submitContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  warehouseList: {
    gap: Spacing.sm,
  },
  warehouseOption: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  warehouseHeader: {
    marginBottom: Spacing.sm,
  },
  warehouseIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  warehouseId: {
    fontWeight: "600",
    flex: 1,
  },
  warehouseCapacity: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  capacityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  progressContainer: {
    marginVertical: Spacing.xs,
  },
  noWarehouseContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
});
