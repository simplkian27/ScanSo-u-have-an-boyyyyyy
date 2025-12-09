import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { TextInput } from "@/components/TextInput";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { Feather } from "@expo/vector-icons";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, loginWithReplit } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReplitLoading, setIsReplitLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Bitte geben Sie E-Mail und Passwort ein");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplitLogin = async () => {
    setError("");
    setIsReplitLoading(true);

    try {
      await loginWithReplit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replit-Anmeldung fehlgeschlagen");
    } finally {
      setIsReplitLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing["4xl"], paddingBottom: insets.bottom + Spacing["2xl"] },
        ]}
      >
        <View style={styles.logoContainer}>
          <View style={styles.iconContainer}>
            <Feather name="package" size={48} color={Colors.light.accent} />
          </View>
          <ThemedText type="h2" style={styles.title}>
            ContainerFlow
          </ThemedText>
          <ThemedText type="body" style={styles.subtitle}>
            Containerverwaltungssystem
          </ThemedText>
        </View>

        <View style={styles.form}>
          <TextInput
            label="E-Mail"
            value={email}
            onChangeText={setEmail}
            placeholder="E-Mail-Adresse eingeben"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              label="Passwort"
              value={password}
              onChangeText={setPassword}
              placeholder="Passwort eingeben"
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={Colors.light.textSecondary}
              />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color={Colors.light.error} />
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          <Button
            onPress={handleLogin}
            disabled={isLoading || isReplitLoading}
            style={styles.loginButton}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              "Anmelden"
            )}
          </Button>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <ThemedText type="small" style={styles.dividerText}>oder</ThemedText>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={handleReplitLogin}
            disabled={isLoading || isReplitLoading}
            style={({ pressed }) => [
              styles.replitButton,
              pressed && styles.replitButtonPressed,
              (isLoading || isReplitLoading) && styles.buttonDisabled,
            ]}
          >
            {isReplitLoading ? (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            ) : (
              <>
                <View style={styles.replitIcon}>
                  <Feather name="box" size={20} color={Colors.light.primary} />
                </View>
                <ThemedText type="bodyBold" style={styles.replitButtonText}>
                  Mit Replit anmelden
                </ThemedText>
              </>
            )}
          </Pressable>

          <View style={styles.infoContainer}>
            <Feather name="info" size={16} color={Colors.light.textSecondary} />
            <ThemedText type="small" style={styles.infoText}>
              Melden Sie sich mit Ihrem Replit-Konto oder E-Mail an. Neue Replit-Benutzer erhalten standardmäßig Fahrerzugang.
            </ThemedText>
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundRoot,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["4xl"],
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.light.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.light.textSecondary,
  },
  form: {
    gap: Spacing.lg,
  },
  passwordContainer: {
    position: "relative",
  },
  eyeButton: {
    position: "absolute",
    right: Spacing.lg,
    top: 38,
    padding: Spacing.sm,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#FFEBEE",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  errorText: {
    color: Colors.light.error,
    flex: 1,
  },
  loginButton: {
    backgroundColor: Colors.light.accent,
    marginTop: Spacing.md,
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundDefault,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.md,
  },
  infoText: {
    color: Colors.light.textSecondary,
    flex: 1,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    color: Colors.light.textTertiary,
    paddingHorizontal: Spacing.lg,
  },
  replitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.backgroundDefault,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderRadius: BorderRadius.md,
    height: Spacing.buttonHeight,
    paddingHorizontal: Spacing.xl,
  },
  replitButtonPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  replitIcon: {
    marginRight: Spacing.sm,
  },
  replitButtonText: {
    color: Colors.light.primary,
  },
});
