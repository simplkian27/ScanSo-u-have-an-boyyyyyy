import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ContainersScreen from "@/screens/ContainersScreen";
import ContainerDetailScreen from "@/screens/ContainerDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ContainersStackParamList = {
  Containers: undefined;
  ContainerDetail: { containerId: string; type: "customer" | "warehouse" };
};

const Stack = createNativeStackNavigator<ContainersStackParamList>();

export default function ContainersStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Containers"
        component={ContainersScreen}
        options={{ headerTitle: "Containers" }}
      />
      <Stack.Screen
        name="ContainerDetail"
        component={ContainerDetailScreen}
        options={{ headerTitle: "Container Details" }}
      />
    </Stack.Navigator>
  );
}
