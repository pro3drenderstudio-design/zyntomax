import { useCallback, useState } from "react";
import { View, Pressable, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getPayroll, openPayroll, type PayrollData } from "../lib/api";
import { Screen, Card, Txt, Row, Badge, Button, EmptyState, Loading } from "../lib/ui";
import { colors, space, radius } from "../lib/theme";
import { naira, shortDate } from "../lib/format";

export default function PayrollScreen() {
  const router = useRouter();
  const [data, setData] = useState<PayrollData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getPayroll();
      setData(d);
      setSiteId((cur) => cur ?? (d.sites[0]?.id ?? null));
    } catch { setData(null); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (data === null) return <Loading />;

  async function runNow() {
    if (!siteId) return;
    setBusy(true);
    try {
      const r = await openPayroll(siteId);
      Alert.alert("Payroll updated", r.staff > 0 ? `${r.staff} staff line${r.staff === 1 ? "" : "s"} tallied for this week.` : "No new earnings to tally.");
      await load();
    } catch (e) {
      Alert.alert("Could not run payroll", e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 8 }}>Run this week's payroll</Txt>
        {data.sites.length > 1 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.md }}>
            {data.sites.map((s) => {
              const active = siteId === s.id;
              return (
                <Pressable key={s.id} onPress={() => setSiteId(s.id)} style={{ borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <Txt variant="small" color={active ? colors.accentDark : colors.text}>{s.name}</Txt>
                </Pressable>
              );
            })}
          </View>
        )}
        <Button title="Tally completed work" loading={busy} onPress={runNow} icon={<Ionicons name="refresh" size={18} color="#fff" />} />
        <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: 6 }}>Safe to run repeatedly — it appends newly-completed jobs to this week's run.</Txt>
      </Card>

      <Txt variant="h3">Recent runs</Txt>
      {data.runs.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="wallet-outline" size={32} color={colors.mutedLight} />} title="No payroll runs yet" /></Card>
      ) : data.runs.map((r) => (
        <Card key={r.id} onPress={() => router.push(`/payroll/${r.id}` as never)}>
          <Row justify="space-between">
            <Txt variant="bodyStrong">Week of {shortDate(r.weekStart)}</Txt>
            <Badge label={r.status} status={r.status} />
          </Row>
          <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>
            {r.site} · {r.staffCount} staff · net {naira(r.netTotal)}
          </Txt>
          {r.unpaidCount > 0 ? <Txt variant="tiny" color={colors.warning} style={{ marginTop: 2 }}>{r.unpaidCount} unpaid</Txt> : null}
        </Card>
      ))}
    </Screen>
  );
}
