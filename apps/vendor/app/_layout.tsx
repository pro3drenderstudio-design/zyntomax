import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
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
        <Stack.Screen name="pickup/new" options={{ title: "Request a pickup", presentation: "modal" }} />
        <Stack.Screen name="pickup/[id]" options={{ title: "Pickup" }} />
        <Stack.Screen name="withdraw" options={{ title: "Withdraw", presentation: "modal" }} />
        <Stack.Screen name="history" options={{ title: "Sales history" }} />
        <Stack.Screen name="help" options={{ title: "Help & support" }} />
        <Stack.Screen name="account/edit" options={{ title: "Edit profile" }} />
        <Stack.Screen name="account/kyc" options={{ title: "Bank & KYC" }} />
        <Stack.Screen name="account/settings" options={{ title: "Settings" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
