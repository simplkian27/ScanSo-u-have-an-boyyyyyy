import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#212529",
    textSecondary: "#5A6572",
    textOnPrimary: "#FFFFFF",
    textOnAccent: "#FFFFFF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#8A95A6",
    tabIconSelected: "#FF6B2C",
    link: "#1F3650",
    backgroundRoot: "#F4F6F8",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#E1E4E8",
    backgroundTertiary: "#D1D5DB",
    primary: "#1F3650",
    primaryLight: "#2D4A6A",
    accent: "#FF6B2C",
    accentLight: "#FF8F5C",
    statusIdle: "#8A95A6",
    statusOpen: "#8A95A6",
    statusInProgress: "#2D8FDB",
    statusCompleted: "#2EAD4A",
    statusCancelled: "#D9423B",
    fillLow: "#2EAD4A",
    fillMedium: "#F5A524",
    fillHigh: "#D9423B",
    border: "#D1D5DB",
    error: "#D9423B",
    warning: "#F5A524",
    warningLight: "#FFB547",
    success: "#2EAD4A",
    cardSurface: "#FFFFFF",
    cardBorder: "#E1E4E8",
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    textOnPrimary: "#FFFFFF",
    textOnAccent: "#FFFFFF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#FF6B2C",
    link: "#5BA3E0",
    backgroundRoot: "#0F1419",
    backgroundDefault: "#1A1F26",
    backgroundSecondary: "#252B33",
    backgroundTertiary: "#303740",
    primary: "#1F3650",
    primaryLight: "#2D4A6A",
    accent: "#FF6B2C",
    accentLight: "#FF8F5C",
    statusIdle: "#6B7280",
    statusOpen: "#6B7280",
    statusInProgress: "#2D8FDB",
    statusCompleted: "#2EAD4A",
    statusCancelled: "#D9423B",
    fillLow: "#2EAD4A",
    fillMedium: "#F5A524",
    fillHigh: "#D9423B",
    border: "#303740",
    error: "#D9423B",
    warning: "#F5A524",
    warningLight: "#FFB547",
    success: "#2EAD4A",
    cardSurface: "#1A1F26",
    cardBorder: "#303740",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 52,
  buttonHeight: 56,
  buttonHeightSmall: 48,
  tabBarHeight: 64,
  touchTargetMin: 48,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  smallBold: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  captionBold: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  button: {
    fontSize: 16,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  link: {
    fontSize: 16,
    fontWeight: "500" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "Roboto, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 4,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const IndustrialDesign = {
  minTouchTarget: 48,
  buttonHeight: 56,
  buttonHeightSmall: 48,
  borderWidth: 2,
  iconSize: 24,
  iconSizeLarge: 32,
  cardPadding: 16,
  listItemHeight: 72,
};
