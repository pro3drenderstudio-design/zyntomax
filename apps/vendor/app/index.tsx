import { useCallback, useState } from "react";
import { ScrollView, Text, View, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getHome, getStoredVendor, logout, type VendorHome } from "../lib/api";
import { Card, Button } from "../lib/ui";
import { colors } from "../lib/theme";

const naira = (n: number) => "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
const kg = (n: number) => n.toLocaleString("en-NG", { maximumFractionDigits: 1 }) + " kg";

export default function HomeScreen() {
  const router = useRouter();
  const [home, setHome] = useState<VendorHome | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    const v = await getStoredVendor();
    if (!v) { router.replace("/login"); return; }
    try { setHome(await getHome()); } catch { /* keep last */ }
    setChecked(true);
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!checked) return null;

  const next = home?.rewards.next;
  const progress = next ? Math.min(1, (home!.lifetimeKg) / next.thresholdKg) : 1;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.hi}>Hello, {home?.vendor.name ?? "there"} 👋</Text>
        <Text style={styles.meta}>{home?.vendor.vendorNo ?? ""}{home?.vendor.locality ? ` · ${home.vendor.locality}` : ""}</Text>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statVal}>{kg(home?.lifetimeKg ?? 0)}</Text><Text style={styles.statLabel}>Recycled</Text></View>
          <View style={styles.stat}><Text style={[styles.statVal, { color: colors.accent }]}>{naira(home?.lifetimeNaira ?? 0)}</Text><Text style={styles.statLabel}>Earned</Text></View>
        </View>
      </Card>

      {next && (
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.rewardTitle}>Next reward: {next.name}</Text>
          <Text style={styles.meta}>{next.reward}</Text>
          <View style={styles.barBg}><View style={[styles.barFill, { width: `${progress * 100}%` }]} /></View>
          <Text style={styles.meta}>{kg(next.remainingKg)} more to go</Text>
        </Card>
      )}

      <Button title="Request a pickup" onPress={() => router.push("/pickup")} />
      <View style={{ height: 10 }} />
      <View style={styles.row}>
        <Tile title="My collections" onPress={() => router.push("/collections")} />
        <Tile title="Payments" onPress={() => router.push("/payments")} />
      </View>
      <View style={{ height: 10 }} />
      <View style={styles.row}>
        <Tile title="Rewards" onPress={() => router.push("/rewards")} />
        <Tile title="Sign out" onPress={async () => { await logout(); router.replace("/login"); }} />
      </View>

      {home && home.collections.length > 0 && (
        <>
          <Text style={styles.section}>Recent collections</Text>
          {home.collections.slice(0, 5).map((c) => (
            <Card key={c.id} style={{ marginBottom: 8 }}>
              <View style={styles.between}>
                <Text style={{ color: colors.text }}>{c.material} · {kg(c.weightKg)}</Text>
                <Text style={{ color: colors.accent, fontWeight: "600" }}>{naira(c.amount)}</Text>
              </View>
              <Text style={styles.meta}>{new Date(c.date).toLocaleDateString("en-NG")}</Text>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function Tile({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <Text style={styles.tileText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hi: { fontSize: 18, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  stats: { flexDirection: "row", gap: 24, marginTop: 12 },
  stat: {},
  statVal: { fontSize: 20, fontWeight: "700", color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted },
  rewardTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  barBg: { height: 10, backgroundColor: colors.limeSoft, borderRadius: 6, marginVertical: 8, overflow: "hidden" },
  barFill: { height: 10, backgroundColor: colors.accent, borderRadius: 6 },
  row: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 18, alignItems: "center" },
  tileText: { fontSize: 15, fontWeight: "600", color: colors.text },
  section: { fontSize: 15, fontWeight: "600", color: colors.text, marginTop: 16, marginBottom: 8 },
  between: { flexDirection: "row", justifyContent: "space-between" },
});
