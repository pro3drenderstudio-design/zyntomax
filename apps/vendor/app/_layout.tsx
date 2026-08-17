import { useEffect, useState } from "react";
import { View, Pressable, AppState } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../lib/theme";
import { I18nProvider } from "../lib/i18n";
import { Txt, Button } from "../lib/ui";
import { isLockEnabled, authenticate } from "../lib/lock";
import { registerForPush } from "../lib/push-register";

function LockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(null);

  const tryUnlock = async () => {
    const ok = await authenticate();
    setLocked(!ok);
  };

  useEffect(() => {
    (async () => {
      if (await isLockEnabled()) { setLocked(true); tryUnlock(); }
      else setLocked(false);
    })();
    // Re-lock when returning from background
    const sub = AppState.addEventListener("change", async (s) => {
      if (s === "active" && (await isLockEnabled())) setLocked((prev) => (prev === false ? false : true));
    });
    return () => sub.remove();
  }, []);

  if (locked === null) return <View style={{ flex: 1, backgroundColor: colors.accent }} />;
  if (locked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <Ionicons name="lock-closed" size={48} color="#fff" />
        <Txt variant="h2" color="#fff" center>Zyntomax is locked</Txt>
        <Pressable onPress={tryUnlock}><Txt variant="bodyStrong" color="#fff">Tap to unlock</Txt></Pressable>
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => { registerForPush(); }, []);
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <StatusBar style="dark" />
        <LockGate>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: "700" },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ title: "Create account" }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="pickup/new" options={{ title: "Request a pickup", presentation: "modal" }} />
            <Stack.Screen name="pickup/[id]" options={{ title: "Pickup" }} />
            <Stack.Screen name="withdraw" options={{ title: "Withdraw", presentation: "modal" }} />
            <Stack.Screen name="history" options={{ title: "Sales history" }} />
            <Stack.Screen name="rates" options={{ title: "Today's rates" }} />
            <Stack.Screen name="referral" options={{ title: "Invite & earn" }} />
            <Stack.Screen name="help" options={{ title: "Help & support" }} />
            <Stack.Screen name="account/edit" options={{ title: "Edit profile" }} />
            <Stack.Screen name="account/kyc" options={{ title: "Bank & KYC" }} />
            <Stack.Screen name="account/settings" options={{ title: "Settings" }} />
          </Stack>
        </LockGate>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
