import { useEffect, useState } from "react";
import { View, Pressable, AppState } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../lib/theme";
import { I18nProvider } from "../lib/i18n";
import { Txt } from "../lib/ui";
import { isLockEnabled, authenticate } from "../lib/lock";
import { registerForPush } from "../lib/push-register";
import { getToken, refreshSession } from "../lib/api";

function LockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(null);
  const tryUnlock = async () => setLocked(!(await authenticate()));

  useEffect(() => {
    (async () => {
      if (await isLockEnabled()) { setLocked(true); tryUnlock(); }
      else setLocked(false);
    })();
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
        <Txt variant="h2" color="#fff" center>Zyntomax Admin is locked</Txt>
        <Pressable onPress={tryUnlock}><Txt variant="bodyStrong" color="#fff">Tap to unlock</Txt></Pressable>
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    registerForPush();
    // Reconcile roles/token with the server on launch (best-effort) so access
    // reflects the latest changes made on the web.
    (async () => { if (await getToken()) await refreshSession(); })();
  }, []);
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
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="trips" options={{ title: "My trips" }} />
            <Stack.Screen name="trip/[id]" options={{ title: "Weigh-in" }} />
            <Stack.Screen name="vendors" options={{ title: "Vendors" }} />
            <Stack.Screen name="vendor-new" options={{ title: "Register vendor", presentation: "modal" }} />
            <Stack.Screen name="pickups" options={{ title: "Pickup requests" }} />
            <Stack.Screen name="admin" options={{ title: "Operations" }} />
            <Stack.Screen name="jobs" options={{ title: "Production jobs" }} />
            <Stack.Screen name="job/[id]" options={{ title: "Job" }} />
            <Stack.Screen name="job-new" options={{ title: "Scale in", presentation: "modal" }} />
            <Stack.Screen name="withdrawals" options={{ title: "Withdrawals" }} />
            <Stack.Screen name="expenses" options={{ title: "Expenses" }} />
            <Stack.Screen name="expense-new" options={{ title: "Record expense", presentation: "modal" }} />
            <Stack.Screen name="reports" options={{ title: "P&L report" }} />
            <Stack.Screen name="staff" options={{ title: "Staff" }} />
            <Stack.Screen name="staff/[id]" options={{ title: "Staff member" }} />
            <Stack.Screen name="payroll" options={{ title: "Payroll" }} />
            <Stack.Screen name="payroll/[id]" options={{ title: "Payroll run" }} />
            <Stack.Screen name="earnings" options={{ title: "My earnings" }} />
            <Stack.Screen name="inventory" options={{ title: "Inventory" }} />
            <Stack.Screen name="inventory/[id]" options={{ title: "Material" }} />
            <Stack.Screen name="sales" options={{ title: "Sales" }} />
            <Stack.Screen name="sales/[id]" options={{ title: "Sale" }} />
            <Stack.Screen name="purchases" options={{ title: "Purchases" }} />
            <Stack.Screen name="purchases/[id]" options={{ title: "Purchase batch" }} />
            <Stack.Screen name="outbox" options={{ title: "Offline sync" }} />
            <Stack.Screen name="soon" options={{ title: "Coming soon" }} />
          </Stack>
        </LockGate>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
