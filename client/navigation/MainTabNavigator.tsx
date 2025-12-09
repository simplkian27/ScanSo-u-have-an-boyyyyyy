import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";
import TasksStackNavigator from "@/navigation/TasksStackNavigator";
import ScannerScreen from "@/screens/ScannerScreen";
import ContainersStackNavigator from "@/navigation/ContainersStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";

export type MainTabParamList = {
  TasksTab: undefined;
  ScannerTab: undefined;
  ContainersTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { isAdmin } = useAuth();

  return (
    <Tab.Navigator
      initialRouteName="TasksTab"
      screenOptions={{
        tabBarActiveTintColor: Colors.light.accent,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          height: Spacing.tabBarHeight,
          backgroundColor: Platform.select({
            ios: "transparent",
            android: Colors.light.backgroundDefault,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tab.Screen
        name="TasksTab"
        component={TasksStackNavigator}
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, size }) => (
            <Feather name="list" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ScannerTab"
        component={ScannerScreen}
        options={{
          title: "Scanner",
          tabBarIcon: ({ color, size }) => (
            <Feather name="maximize" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ContainersTab"
        component={ContainersStackNavigator}
        options={{
          title: "Containers",
          tabBarIcon: ({ color, size }) => (
            <Feather name="package" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: isAdmin ? "Admin" : "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name={isAdmin ? "grid" : "user"} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
