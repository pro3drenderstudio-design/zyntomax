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
        <Stack.Screen name="index" options={{ title: "Zyntomax Field" }} />
        <Stack.Screen name="login" options={{ title: "Sign in", headerShown: false }} />
        <Stack.Screen name="vendor-new" options={{ title: "Register vendor" }} />
        <Stack.Screen name="trips" options={{ title: "My trips" }} />
        <Stack.Screen name="trip/[id]" options={{ title: "Weigh-in" }} />
        <Stack.Screen name="outbox" options={{ title: "Pending sync" }} />
      </Stack>
    </>
  );
}
