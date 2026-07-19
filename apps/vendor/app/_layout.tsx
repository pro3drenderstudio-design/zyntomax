import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.accent },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ title: "Zyntomax" }} />
        <Stack.Screen name="pickup" options={{ title: "Request pickup" }} />
        <Stack.Screen name="collections" options={{ title: "My collections" }} />
        <Stack.Screen name="payments" options={{ title: "Payments" }} />
        <Stack.Screen name="rewards" options={{ title: "Rewards" }} />
      </Stack>
    </>
  );
}
