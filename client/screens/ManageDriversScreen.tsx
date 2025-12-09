import React, { useState } from "react";
import { View, StyleSheet, FlatList, Modal, ActivityIndicator, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
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
import { User } from "@shared/schema";

type UserWithoutPassword = Omit<User, "password">;

export default function ManageDriversScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { data: users = [], isLoading, refetch } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
  });

  const drivers = users.filter((u) => u.role === "driver");

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
  };

  const handleCreateDriver = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await apiRequest("POST", "/api/users", {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: "driver",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateModal(false);
      setFormData({ name: "", email: "", password: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create driver");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDriverStatus = async (userId: string, isActive: boolean) => {
    try {
      await apiRequest("PATCH", `/api/users/${userId}`, { isActive: !isActive });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (err) {
      console.error("Failed to update driver status:", err);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderDriver = ({ item }: { item: UserWithoutPassword }) => (
    <Card style={[styles.driverCard, !item.isActive && styles.inactiveCard]}>
      <View style={styles.driverHeader}>
        <View style={styles.driverInfo}>
          <View style={[styles.avatar, !item.isActive && styles.inactiveAvatar]}>
            <ThemedText type="body" style={styles.avatarText}>
              {getInitials(item.name)}
            </ThemedText>
          </View>
          <View>
            <ThemedText type="h4">{item.name}</ThemedText>
            <ThemedText type="small" style={styles.email}>{item.email}</ThemedText>
          </View>
        </View>
        <Pressable
          style={[styles.statusButton, item.isActive ? styles.activeButton : styles.inactiveButton]}
          onPress={() => toggleDriverStatus(item.id, item.isActive)}
        >
          <Feather
            name={item.isActive ? "check" : "x"}
            size={16}
            color={item.isActive ? Colors.light.success : Colors.light.error}
          />
          <ThemedText
            type="small"
            style={[styles.statusText, { color: item.isActive ? Colors.light.success : Colors.light.error }]}
          >
            {item.isActive ? "Active" : "Inactive"}
          </ThemedText>
        </Pressable>
      </View>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="users" size={48} color={Colors.light.textSecondary} />
      <ThemedText type="h4" style={styles.emptyTitle}>
        No drivers yet
      </ThemedText>
      <ThemedText type="body" style={styles.emptySubtitle}>
        Add drivers to assign tasks
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { marginTop: headerHeight }]}>
        <ThemedText type="body" style={styles.headerText}>
          {drivers.length} driver{drivers.length !== 1 ? "s" : ""}
        </ThemedText>
        <Button
          style={styles.addButton}
          onPress={() => {
            generatePassword();
            setShowCreateModal(true);
          }}
        >
          <View style={styles.addContent}>
            <Feather name="plus" size={18} color="#FFFFFF" />
            <ThemedText type="small" style={styles.addText}>Add Driver</ThemedText>
          </View>
        </Button>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
        </View>
      ) : (
        <FlatList
          data={drivers}
          keyExtractor={(item) => item.id}
          renderItem={renderDriver}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl },
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAwareScrollViewCompat
            contentContainerStyle={styles.modalScrollContent}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <ThemedText type="h3">Add New Driver</ThemedText>
                <Pressable
                  onPress={() => setShowCreateModal(false)}
                  style={styles.closeButton}
                >
                  <Feather name="x" size={24} color={Colors.light.text} />
                </Pressable>
              </View>

              <View style={styles.form}>
                <TextInput
                  label="Full Name"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Enter driver's name"
                  autoCapitalize="words"
                />

                <TextInput
                  label="Email"
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="Enter email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <View style={styles.passwordRow}>
                  <View style={styles.passwordInput}>
                    <TextInput
                      label="Password"
                      value={formData.password}
                      onChangeText={(text) => setFormData({ ...formData, password: text })}
                      placeholder="Enter password"
                    />
                  </View>
                  <Pressable
                    style={styles.generateButton}
                    onPress={generatePassword}
                  >
                    <Feather name="refresh-cw" size={20} color={Colors.light.primary} />
                  </Pressable>
                </View>

                {error ? (
                  <View style={styles.errorBanner}>
                    <Feather name="alert-circle" size={16} color={Colors.light.error} />
                    <ThemedText type="small" style={styles.errorText}>
                      {error}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              <View style={styles.modalActions}>
                <Button
                  style={styles.cancelButton}
                  onPress={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  style={styles.submitButton}
                  onPress={handleCreateDriver}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    "Create Driver"
                  )}
                </Button>
              </View>
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundRoot,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.light.backgroundDefault,
  },
  headerText: {
    color: Colors.light.textSecondary,
  },
  addButton: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: Spacing.md,
    height: 40,
  },
  addContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  addText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  driverCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  inactiveCard: {
    opacity: 0.6,
  },
  driverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  inactiveAvatar: {
    backgroundColor: Colors.light.textSecondary,
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  email: {
    color: Colors.light.textSecondary,
  },
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  activeButton: {
    backgroundColor: "#E8F5E9",
  },
  inactiveButton: {
    backgroundColor: "#FFEBEE",
  },
  statusText: {
    fontWeight: "500",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    color: Colors.light.text,
  },
  emptySubtitle: {
    color: Colors.light.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
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
    marginBottom: Spacing.xl,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  form: {
    gap: Spacing.lg,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.md,
  },
  passwordInput: {
    flex: 1,
  },
  generateButton: {
    width: Spacing.inputHeight,
    height: Spacing.inputHeight,
    backgroundColor: Colors.light.backgroundDefault,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
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
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  submitButton: {
    flex: 1,
    backgroundColor: Colors.light.accent,
  },
});
