import { useState } from "react";
import { View, Text, Image, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { requestOtp, verifyOtp } from "../lib/api";
import { Field, Button, Label, ErrorText, Card } from "../lib/ui";
import { colors } from "../lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    if (!/^0\d{10}$/.test(phone.trim())) return setError("Enter your 11-digit phone number.");
    setBusy(true); setError(null);
    try {
      const { devCode } = await requestOtp(phone.trim());
      setStep("code");
      if (devCode) Alert.alert("Demo code", `Your login code is ${devCode} (shown because SMS is not configured).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setError(null);
    try {
      await verifyOtp(phone.trim(), code.trim());
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.logoWrap}>
        <Image source={require("../assets/logo.png")} style={{ width: 120, height: 120, resizeMode: "contain" }} />
        <Text style={styles.title}>Zyntomax</Text>
        <Text style={styles.subtitle}>Recycle. Earn. Get rewarded.</Text>
      </View>

      <Card>
        {step === "phone" ? (
          <>
            <Label>Your phone number</Label>
            <Field value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="08012345678" autoComplete="tel" />
            <View style={{ height: 16 }} />
            <ErrorText>{error}</ErrorText>
            {error ? <View style={{ height: 8 }} /> : null}
            <Button title={busy ? "Sending…" : "Send code"} onPress={sendCode} disabled={busy} />
            <Text style={styles.hint}>We&apos;ll text you a 6-digit code. Only numbers registered with a collector can sign in.</Text>
          </>
        ) : (
          <>
            <Label>Enter the code sent to {phone}</Label>
            <Field value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="123456" style={{ fontSize: 24, textAlign: "center", letterSpacing: 6 }} />
            <View style={{ height: 16 }} />
            <ErrorText>{error}</ErrorText>
            {error ? <View style={{ height: 8 }} /> : null}
            <Button title={busy ? "Verifying…" : "Verify & sign in"} onPress={verify} disabled={busy} />
            <View style={{ height: 8 }} />
            <Button title="Change number" variant="secondary" onPress={() => { setStep("phone"); setCode(""); setError(null); }} />
          </>
        )}
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: 20 },
  logoWrap: { alignItems: "center", marginBottom: 24 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginTop: 6 },
  subtitle: { fontSize: 14, color: colors.muted },
  hint: { fontSize: 12, color: colors.muted, marginTop: 10, textAlign: "center" },
});
