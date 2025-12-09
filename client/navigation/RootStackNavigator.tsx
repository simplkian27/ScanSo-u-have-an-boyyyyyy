import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NetworkStatusBar } from "@/components/NetworkStatusBar";

export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainWithStatusBar() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.mainContainer}>
      <View style={{ paddingTop: insets.top, backgroundColor: Colors.light.backgroundDefault }}>
        <NetworkStatusBar />
      </View>
      <View style={styles.content}>
        <MainTabNavigator />
      </View>
    </View>
  );
}

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAuthenticated ? (
        <Stack.Screen
          name="Main"
          component={MainWithStatusBar}
          options={{ headerShown: false }}
        />
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundRoot,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.light.backgroundRoot,
  },
  content: {
    flex: 1,
  },
});
