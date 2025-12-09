import React, { ReactNode } from "react";
import { StyleSheet, Pressable, ViewStyle, StyleProp } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Typography, AnimationConfig } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: "default" | "small";
}

const springConfig: WithSpringConfig = {
  damping: AnimationConfig.spring.damping,
  mass: AnimationConfig.spring.mass,
  stiffness: AnimationConfig.spring.stiffness,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  onPress,
  children,
  style,
  disabled = false,
  variant = "primary",
  size = "default",
}: ButtonProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(AnimationConfig.pressScale, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig);
    }
  };

  const getButtonStyles = (): ViewStyle => {
    const baseHeight = size === "small" ? Spacing.buttonHeightSmall : Spacing.buttonHeight;
    
    switch (variant) {
      case "primary":
        return {
          backgroundColor: theme.accent,
          height: baseHeight,
        };
      case "secondary":
        return {
          backgroundColor: "transparent",
          borderWidth: 2,
          borderColor: theme.primary,
          height: baseHeight,
        };
      case "tertiary":
        return {
          backgroundColor: theme.backgroundSecondary,
          height: baseHeight,
        };
      case "danger":
        return {
          backgroundColor: theme.error,
          height: baseHeight,
        };
      default:
        return {
          backgroundColor: theme.accent,
          height: baseHeight,
        };
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case "primary":
      case "danger":
        return "#FFFFFF";
      case "secondary":
        return theme.primary;
      case "tertiary":
        return theme.text;
      default:
        return "#FFFFFF";
    }
  };

  const buttonStyles = getButtonStyles();
  const textColor = getTextColor();

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.button,
        buttonStyles,
        {
          opacity: disabled ? 0.5 : 1,
        },
        style,
        animatedStyle,
      ]}
    >
      <ThemedText
        type={size === "small" ? "small" : "body"}
        style={[
          styles.buttonText,
          size === "small" ? styles.buttonTextSmall : null,
          { color: textColor },
        ]}
      >
        {children}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  buttonText: {
    fontWeight: "700",
    letterSpacing: Typography.button.letterSpacing,
  },
  buttonTextSmall: {
    fontSize: Typography.buttonSmall.fontSize,
    fontWeight: "600",
  },
});
