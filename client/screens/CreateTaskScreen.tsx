import React, { useState } from "react";
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
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { CustomerContainer, User } from "@shared/schema";

type UserWithoutPassword = Omit<User, "password">;

export default function CreateTaskScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { data: containers = [] } = useQuery<CustomerContainer[]>({
    queryKey: ["/api/containers/customer"],
  });

  const { data: users = [] } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
  });

  const drivers = users.filter((u) => u.role === "driver" && u.isActive);
  const selectedContainerData = containers.find((c) => c.id === selectedContainer);

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
                  selectedContainer === container.id && styles.containerSelected,
                ]}
                onPress={() => setSelectedContainer(container.id)}
              >
                <Feather
                  name="package"
                  size={24}
                  color={selectedContainer === container.id ? Colors.light.accent : Colors.light.textSecondary}
                />
                <ThemedText
                  type="body"
                  style={[
                    styles.containerOptionText,
                    selectedContainer === container.id && styles.containerSelectedText,
                  ]}
                >
                  {container.id}
                </ThemedText>
                <ThemedText type="small" style={styles.containerLocation}>
                  {container.customerName}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
          {selectedContainerData ? (
            <View style={styles.selectedInfo}>
              <Feather name="info" size={16} color={Colors.light.textSecondary} />
              <ThemedText type="small" style={styles.selectedInfoText}>
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
                  selectedDriver === driver.id && styles.driverSelected,
                ]}
                onPress={() => setSelectedDriver(driver.id)}
              >
                <View
                  style={[
                    styles.driverAvatar,
                    selectedDriver === driver.id && styles.driverAvatarSelected,
                  ]}
                >
                  <ThemedText type="small" style={styles.driverInitials}>
                    {driver.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </ThemedText>
                </View>
                <ThemedText
                  type="body"
                  style={selectedDriver === driver.id ? styles.driverSelectedText : undefined}
                >
                  {driver.name}
                </ThemedText>
                {selectedDriver === driver.id ? (
                  <Feather name="check" size={20} color={Colors.light.accent} />
                ) : null}
              </Pressable>
            ))}
          </View>
          {drivers.length === 0 ? (
            <ThemedText type="small" style={styles.noDrivers}>
              Keine aktiven Fahrer verfügbar
            </ThemedText>
          ) : null}
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
            <ThemedText type="small" style={styles.label}>Priorität</ThemedText>
            <View style={styles.priorityOptions}>
              {(["normal", "high", "urgent"] as const).map((p) => (
                <Pressable
                  key={p}
                  style={[
                    styles.priorityOption,
                    priority === p && styles.prioritySelected,
                    priority === p && p === "urgent" && styles.priorityUrgent,
                    priority === p && p === "high" && styles.priorityHigh,
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <ThemedText
                    type="small"
                    style={[
                      styles.priorityText,
                      priority === p && styles.prioritySelectedText,
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
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={16} color={Colors.light.error} />
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <Button
          style={styles.submitButton}
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
    backgroundColor: Colors.light.backgroundRoot,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  section: {
    backgroundColor: Colors.light.backgroundDefault,
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
    backgroundColor: Colors.light.backgroundSecondary,
    minWidth: 100,
  },
  containerSelected: {
    backgroundColor: `${Colors.light.accent}20`,
    borderWidth: 2,
    borderColor: Colors.light.accent,
  },
  containerOptionText: {
    marginTop: Spacing.xs,
    fontWeight: "600",
  },
  containerSelectedText: {
    color: Colors.light.accent,
  },
  containerLocation: {
    color: Colors.light.textSecondary,
    fontSize: 11,
  },
  selectedInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundSecondary,
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  selectedInfoText: {
    color: Colors.light.textSecondary,
    flex: 1,
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
    backgroundColor: Colors.light.backgroundSecondary,
  },
  driverSelected: {
    backgroundColor: `${Colors.light.accent}20`,
    borderWidth: 2,
    borderColor: Colors.light.accent,
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  driverAvatarSelected: {
    backgroundColor: Colors.light.accent,
  },
  driverInitials: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  driverSelectedText: {
    color: Colors.light.accent,
    fontWeight: "600",
  },
  noDrivers: {
    color: Colors.light.textSecondary,
    textAlign: "center",
    padding: Spacing.lg,
  },
  label: {
    fontWeight: "500",
    color: Colors.light.text,
    marginBottom: Spacing.xs,
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
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  prioritySelected: {
    backgroundColor: `${Colors.light.accent}20`,
    borderColor: Colors.light.accent,
  },
  priorityHigh: {
    backgroundColor: `${Colors.light.warning}20`,
    borderColor: Colors.light.warning,
  },
  priorityUrgent: {
    backgroundColor: `${Colors.light.error}20`,
    borderColor: Colors.light.error,
  },
  priorityText: {
    color: Colors.light.textSecondary,
  },
  prioritySelectedText: {
    color: Colors.light.text,
    fontWeight: "600",
  },
  notesInput: {
    height: 80,
    textAlignVertical: "top",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#FFEBEE",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  errorText: {
    color: Colors.light.error,
    flex: 1,
  },
  submitButton: {
    backgroundColor: Colors.light.accent,
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
});
