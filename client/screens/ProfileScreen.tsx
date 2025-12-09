import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "Profile">;

export default function ProfileScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <ThemedText type="h2" style={styles.avatarText}>
              {getInitials(user?.name || "User")}
            </ThemedText>
          </View>
          <ThemedText type="h3" style={styles.userName}>
            {user?.name}
          </ThemedText>
          <View style={styles.roleBadge}>
            <Feather
              name={isAdmin ? "shield" : "truck"}
              size={14}
              color={Colors.light.primary}
            />
            <ThemedText type="small" style={styles.roleText}>
              {isAdmin ? "Administrator" : "Driver"}
            </ThemedText>
          </View>
        </View>

        <Card style={styles.infoCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Account Information
          </ThemedText>
          <View style={styles.infoRow}>
            <Feather name="mail" size={20} color={Colors.light.textSecondary} />
            <View style={styles.infoContent}>
              <ThemedText type="small" style={styles.infoLabel}>Email</ThemedText>
              <ThemedText type="body">{user?.email}</ThemedText>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Feather name="calendar" size={20} color={Colors.light.textSecondary} />
            <View style={styles.infoContent}>
              <ThemedText type="small" style={styles.infoLabel}>Member Since</ThemedText>
              <ThemedText type="body">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })
                  : "N/A"}
              </ThemedText>
            </View>
          </View>
        </Card>

        {isAdmin ? (
          <Card style={styles.adminCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Quick Actions
            </ThemedText>
            <Pressable
              style={styles.menuItem}
              onPress={() => navigation.navigate("AdminDashboard")}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="grid" size={20} color={Colors.light.primary} />
                <ThemedText type="body">Dashboard</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={Colors.light.textSecondary} />
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => navigation.navigate("ManageDrivers")}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="users" size={20} color={Colors.light.primary} />
                <ThemedText type="body">Manage Drivers</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={Colors.light.textSecondary} />
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => navigation.navigate("ActivityLog")}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="activity" size={20} color={Colors.light.primary} />
                <ThemedText type="body">Activity Log</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={Colors.light.textSecondary} />
            </Pressable>
          </Card>
        ) : null}

        <Card style={styles.settingsCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Settings
          </ThemedText>
          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Feather name="bell" size={20} color={Colors.light.textSecondary} />
              <ThemedText type="body">Notifications</ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.light.textSecondary} />
          </Pressable>
          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Feather name="help-circle" size={20} color={Colors.light.textSecondary} />
              <ThemedText type="body">Help & Support</ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.light.textSecondary} />
          </Pressable>
        </Card>

        <Button onPress={handleLogout} style={styles.logoutButton}>
          <View style={styles.logoutContent}>
            <Feather name="log-out" size={20} color="#FFFFFF" />
            <ThemedText type="body" style={styles.logoutText}>
              Sign Out
            </ThemedText>
          </View>
        </Button>

        <ThemedText type="small" style={styles.versionText}>
          ContainerFlow v1.0.0
        </ThemedText>
      </ScrollView>
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
  profileHeader: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatarText: {
    color: "#FFFFFF",
  },
  userName: {
    marginBottom: Spacing.sm,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.light.backgroundDefault,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  roleText: {
    color: Colors.light.primary,
    fontWeight: "500",
  },
  infoCard: {
    backgroundColor: Colors.light.backgroundDefault,
    gap: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  adminCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  settingsCard: {
    backgroundColor: Colors.light.backgroundDefault,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  logoutButton: {
    backgroundColor: Colors.light.error,
    marginTop: Spacing.md,
  },
  logoutContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  versionText: {
    textAlign: "center",
    color: Colors.light.textSecondary,
    marginTop: Spacing.md,
  },
});
