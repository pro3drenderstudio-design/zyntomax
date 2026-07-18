import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getStoredUser, loadBootstrap, logout, type MobileUser } from "../lib/api";
import { getQueue, flushQueue } from "../lib/queue";
import { Button, Card } from "../lib/ui";
import { colors } from "../lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<MobileUser | null>(null);
  const [pending, setPending] = useState(0);
  const [checked, setChecked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const u = await getStoredUser();
        if (!u) {
          router.replace("/login");
          return;
        }
        setUser(u);
        setChecked(true);
        loadBootstrap(true); // refresh master data in the background
        const [, remaining] = await flushQueue(); // opportunistic sync
        setPending(remaining);
      })();
    }, [router]),
  );

  if (!checked || !user) return null;

  const tiles: { title: string; hint: string; href: string; show: boolean }[] = [
    {
      title: "Admin overview",
      hint: "Live KPIs, approvals & oversight",
      href: "/admin",
      show: user.roles.some((r) =>
        ["OPERATIONS_MANAGER", "FACTORY_SUPERVISOR", "FINANCE_ADMIN", "SUPER_ADMIN"].includes(r),
      ),
    },
    {
      title: "Register vendor",
      hint: "New household vendor with GPS pin",
      href: "/vendor-new",
      show: user.roles.some((r) =>
        ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER", "SUPER_ADMIN"].includes(r),
      ),
    },
    {
      title: "My trips",
      hint: "Record weigh-ins on today's route",
      href: "/trips",
      show: user.roles.some((r) =>
        ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER", "SUPER_ADMIN"].includes(r),
      ),
    },
    {
      title: "Pickup requests",
      hint: "Pending pickups with navigation",
      href: "/pickups",
      show: user.roles.some((r) =>
        ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER", "SUPER_ADMIN"].includes(r),
      ),
    },
    {
      title: "Vendors",
      hint: "Browse, call & navigate to vendors",
      href: "/vendors",
      show: user.roles.some((r) =>
        ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER", "SUPER_ADMIN"].includes(r),
      ),
    },
    {
      title: `Pending sync${pending > 0 ? ` (${pending})` : ""}`,
      hint: pending > 0 ? "Records waiting for network" : "Everything is synced",
      href: "/outbox",
      show: true,
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ marginBottom: 16 }}>
        <Text style={styles.greeting}>{user.name}</Text>
        <Text style={styles.meta}>
          {user.staffNo ?? ""} · {user.roles.map((r) => r.replace(/_/g, " ")).join(", ")}
        </Text>
      </Card>

      {tiles.filter((t) => t.show).map((t) => (
        <Pressable
          key={t.href}
          onPress={() => router.push(t.href as never)}
          style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={t.title}
        >
          <Text style={styles.tileTitle}>{t.title}</Text>
          <Text style={styles.tileHint}>{t.hint}</Text>
        </Pressable>
      ))}

      <View style={{ height: 24 }} />
      <Button
        title="Sign out"
        variant="secondary"
        onPress={async () => {
          await logout();
          router.replace("/login");
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  greeting: { fontSize: 18, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    padding: 16,
    marginBottom: 10,
  },
  tileTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  tileHint: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
