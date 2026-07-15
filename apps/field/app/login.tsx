import { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { login } from "../lib/api";
import { Field, Button, Label, ErrorText, Card } from "../lib/ui";
import { colors } from "../lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(phone.trim(), password);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.logoWrap}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoIcon}>♻</Text>
        </View>
        <Text style={styles.title}>Zyntomax Field</Text>
        <Text style={styles.subtitle}>Collection & registration</Text>
      </View>

      <Card>
        <Label>Phone number</Label>
        <Field
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="08012345678"
        />
        <Label>Password</Label>
        <Field
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />
        <View style={{ height: 16 }} />
        <ErrorText>{error}</ErrorText>
        {error && <View style={{ height: 8 }} />}
        <Button title={busy ? "Signing in…" : "Sign in"} onPress={submit} disabled={busy} />
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: 20,
  },
  logoWrap: { alignItems: "center", marginBottom: 24 },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoIcon: { fontSize: 32, color: "#ffffff" },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted },
});
