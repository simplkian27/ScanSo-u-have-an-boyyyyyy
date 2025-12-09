import React from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useNetwork } from "@/contexts/NetworkContext";

export function NetworkStatusBar() {
  const { isOnline, pendingActionsCount, lastSyncText, syncPendingActions, isSyncing } = useNetwork();

  if (isOnline && pendingActionsCount === 0) {
    return null;
  }

  return (
    <View style={[styles.container, !isOnline ? styles.offline : styles.pending]}>
      {!isOnline ? (
        <View style={styles.content}>
          <Feather name="wifi-off" size={16} color={Colors.light.textOnAccent} />
          <ThemedText type="small" style={styles.text}>
            You're offline. Changes will sync when connected.
          </ThemedText>
        </View>
      ) : pendingActionsCount > 0 ? (
        <Pressable style={styles.content} onPress={syncPendingActions} disabled={isSyncing}>
          {isSyncing ? (
            <ActivityIndicator size="small" color={Colors.light.textOnAccent} />
          ) : (
            <Feather name="refresh-cw" size={16} color={Colors.light.textOnAccent} />
          )}
          <ThemedText type="small" style={styles.text}>
            {isSyncing 
              ? "Syncing..." 
              : `${pendingActionsCount} pending ${pendingActionsCount === 1 ? "action" : "actions"}. Tap to sync.`
            }
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  offline: {
    backgroundColor: Colors.light.statusCancelled,
  },
  pending: {
    backgroundColor: Colors.light.statusInProgress,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  text: {
    color: Colors.light.textOnAccent,
    fontWeight: "500",
  },
});
