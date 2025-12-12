import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "@/screens/ProfileScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import ManageDriversScreen from "@/screens/ManageDriversScreen";
import AutomotiveManagementScreen from "@/screens/AutomotiveManagementScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";

export type ProfileStackParamList = {
  Profile: undefined;
  AdminDashboard: undefined;
  ManageDrivers: undefined;
  AutomotiveManagement: undefined;
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
