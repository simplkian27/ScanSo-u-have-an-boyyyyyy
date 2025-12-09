import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "@/screens/ProfileScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import ManageDriversScreen from "@/screens/ManageDriversScreen";
import ManageContainersScreen from "@/screens/ManageContainersScreen";
import CreateTaskScreen from "@/screens/CreateTaskScreen";
import ActivityLogScreen from "@/screens/ActivityLogScreen";
import AnalyticsScreen from "@/screens/AnalyticsScreen";
import DriverPerformanceScreen from "@/screens/DriverPerformanceScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";

export type ProfileStackParamList = {
  Profile: undefined;
  AdminDashboard: undefined;
  ManageDrivers: undefined;
  ManageContainers: undefined;
  CreateTask: undefined;
  ActivityLog: undefined;
  Analytics: undefined;
  DriverPerformance: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAdmin } = useAuth();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAdmin ? (
        <>
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{ headerTitle: "Dashboard" }}
          />
          <Stack.Screen
            name="ManageDrivers"
            component={ManageDriversScreen}
            options={{ headerTitle: "Manage Drivers" }}
          />
          <Stack.Screen
            name="ManageContainers"
            component={ManageContainersScreen}
            options={{ headerTitle: "Manage Containers" }}
          />
          <Stack.Screen
            name="CreateTask"
            component={CreateTaskScreen}
            options={{ headerTitle: "Create Task" }}
          />
          <Stack.Screen
            name="ActivityLog"
            component={ActivityLogScreen}
            options={{ headerTitle: "Activity Log" }}
          />
          <Stack.Screen
            name="Analytics"
            component={AnalyticsScreen}
            options={{ headerTitle: "Analytics" }}
          />
          <Stack.Screen
            name="DriverPerformance"
            component={DriverPerformanceScreen}
            options={{ headerTitle: "Driver Performance" }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ headerTitle: "Profile" }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ headerTitle: "Profile" }}
        />
      )}
    </Stack.Navigator>
  );
}
