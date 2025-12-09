import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Colors, BorderRadius } from "@/constants/theme";

interface ProgressBarProps {
  progress: number;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  color = Colors.light.accent,
  backgroundColor = Colors.light.backgroundSecondary,
  style,
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  const animatedStyle = useAnimatedStyle(() => ({
    width: withSpring(`${clampedProgress * 100}%`, {
      damping: 15,
      stiffness: 100,
    }),
  }));

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <Animated.View
        style={[styles.fill, { backgroundColor: color }, animatedStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
});
