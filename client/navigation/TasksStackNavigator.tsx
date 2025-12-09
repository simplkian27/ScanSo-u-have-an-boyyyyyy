import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TasksScreen from "@/screens/TasksScreen";
import TaskDetailScreen from "@/screens/TaskDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { Task } from "@shared/schema";

export type TasksStackParamList = {
  Tasks: undefined;
  TaskDetail: { taskId: string };
};

const Stack = createNativeStackNavigator<TasksStackParamList>();

export default function TasksStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ headerTitle: "Tasks" }}
      />
      <Stack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ headerTitle: "Task Details" }}
      />
    </Stack.Navigator>
  );
}
