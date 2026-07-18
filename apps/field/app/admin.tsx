import { useCallback, useState } from "react";
import { ScrollView, Text, View, StyleSheet, RefreshControl, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { getAdminDashboard, approveTrip, type AdminDashboard } from "../lib/api";
import { Card, Button } from "../lib/ui";
import { colors } from "../lib/theme";

const naira = (n: number) => "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
const kg = (n: number) => n.toLocaleString("en-NG", { maximumFractionDigits: 1 }) + " kg";

export default function AdminScreen() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await getAdminDashboard()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load"); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onApprove(tripId: string, locality: string) {
    setBusy(tripId);
    try {
      await approveTrip(tripId);
      Alert.alert("Approved", `${locality} trip approved. Finance can now release the payout.`);
      await load();
    } catch (e) {
      Alert.alert("Could not approve", e instanceof Error ? e.message : "Failed");
    } finally { setBusy(null); }
  }

  const k = data?.kpis;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      {error && <Card style={{ marginBottom: 12 }}><Text style={{ color: colors.destructive }}>{error}</Text></Card>}

      {k && (
        <>
          <View style={styles.grid}>
            <Stat label="Collected today" value={kg(k.collectedTodayKg)} sub={naira(k.collectedTodayNaira)} />
            <Stat label="Active vendors" value={String(k.activeVendors)} />
            <Stat label="In processing" value={kg(k.wipKg)} />
            <Stat label="Finished goods" value={kg(k.finishedKg)} />
            <Stat label="Wallet" value={naira(k.walletBalance)} tone={k.walletBalance <= 0 ? "bad" : "good"} />
            <Stat label="Active trips" value={String(k.activeTrips)} />
          </View>

          {k.flaggedJobs > 0 && (
            <Card style={{ marginTop: 4, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colors.destructive }}>
              <Text style={{ color: colors.destructive, fontWeight: "600" }}>
                {k.flaggedJobs} production job{k.flaggedJobs > 1 ? "s" : ""} flagged for discrepancy
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Resolve on the web admin.</Text>
            </Card>
          )}
        </>
      )}

      <Text style={styles.section}>Trips awaiting approval</Text>
      {data?.approvals.reconciledTrips.length === 0 && (
        <Card style={{ marginBottom: 10 }}><Text style={{ color: colors.muted, textAlign: "center", paddingVertical: 8 }}>Nothing awaiting approval.</Text></Card>
      )}
      {data?.approvals.reconciledTrips.map((t) => (
        <Card key={t.id} style={{ marginBottom: 10 }}>
          <Text style={styles.name}>{t.locality} — {new Date(t.date).toLocaleDateString("en-NG")}</Text>
          <Text style={styles.meta}>{t.vendors} vendors · payout {naira(t.payout)}</Text>
          <View style={{ height: 8 }} />
          <Button title={busy === t.id ? "Approving…" : "Approve & create payout"} onPress={() => onApprove(t.id, t.locality)} disabled={busy === t.id} />
        </Card>
      ))}

      <Text style={styles.section}>Payout batches</Text>
      {data?.approvals.readyBatches.length === 0 && (
        <Card><Text style={{ color: colors.muted, textAlign: "center", paddingVertical: 8 }}>No payout batches pending.</Text></Card>
      )}
      {data?.approvals.readyBatches.map((b) => (
        <Card key={b.id} style={{ marginBottom: 10 }}>
          <Text style={styles.name}>{b.locality} · {naira(b.total)}</Text>
          <Text style={styles.meta}>{b.vendors} vendors · {b.status.replace(/_/g, " ")}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Release payouts from the finance web app.</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone === "bad" && { color: colors.destructive }, tone === "good" && { color: colors.accent }]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  stat: { width: "48%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12 },
  statLabel: { fontSize: 11, color: colors.muted, textTransform: "uppercase" },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 2 },
  statSub: { fontSize: 12, color: colors.muted },
  section: { fontSize: 15, fontWeight: "600", color: colors.text, marginTop: 14, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 1 },
});
