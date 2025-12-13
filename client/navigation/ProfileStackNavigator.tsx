import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "@/screens/ProfileScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import ManageDriversScreen from "@/screens/ManageDriversScreen";
import AutomotiveManagementScreen from "@/screens/AutomotiveManagementScreen";
import DepartmentManagementScreen from "@/screens/DepartmentManagementScreen";
import ActivityScreen from "@/screens/ActivityScreen";
import AnalyticsScreen from "@/screens/AnalyticsScreen";
import ScheduleManagementScreen from "@/screens/ScheduleManagementScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";

export type ProfileStackParamList = {
  Profile: undefined;
  AdminDashboard: undefined;
  ManageDrivers: undefined;
  AutomotiveManagement: undefined;
  DepartmentManagement: undefined;
  Activity: undefined;
  Analytics: undefined;
  ScheduleManagement: undefined;
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
            options={{ headerTitle: "Fahrer verwalten" }}
          />
          <Stack.Screen
            name="AutomotiveManagement"
            component={AutomotiveManagementScreen}
            options={{ headerTitle: "Automotive Fabrik" }}
          />
          <Stack.Screen
            name="DepartmentManagement"
            component={DepartmentManagementScreen}
            options={{ headerTitle: "Abteilungen" }}
          />
          <Stack.Screen
            name="Activity"
            component={ActivityScreen}
            options={{ headerTitle: "Aktivität" }}
          />
          <Stack.Screen
            name="Analytics"
            component={AnalyticsScreen}
            options={{ headerTitle: "Statistiken" }}
          />
          <Stack.Screen
            name="ScheduleManagement"
            component={ScheduleManagementScreen}
            options={{ headerTitle: "Zeitpläne" }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ headerTitle: "Profil" }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ headerTitle: "Profil" }}
        />
      )}
    </Stack.Navigator>
  );
}
