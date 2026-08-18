import { useCallback, useState } from "react";
import { View, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getWithdrawals, approveWithdrawal, rejectWithdrawal, type WithdrawalQueue } from "../lib/api";
import { Screen, Card, Txt, Row, Badge, Button, StatCard, EmptyState, Loading } from "../lib/ui";
import { colors, space } from "../lib/theme";
import { naira, relativeDate } from "../lib/format";

export default function WithdrawalsScreen() {
  const [data, setData] = useState<WithdrawalQueue | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await getWithdrawals()); } catch { setData(null); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (data === null) return <Loading />;

  async function onApprove(id: string, vendor: string, amount: number) {
    Alert.alert("Pay withdrawal?", `Send ${naira(amount)} to ${vendor}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Pay now", style: "default", onPress: async () => {
          setBusy(id);
          try { const r = await approveWithdrawal(id); Alert.alert(r.status === "PAID" ? "Paid 💸" : "Approved", `${naira(amount)} to ${vendor}.`); await load(); }
          catch (e) { Alert.alert("Could not pay", e instanceof Error ? e.message : "Failed"); }
          finally { setBusy(null); }
        },
      },
    ]);
  }
  async function onReject(id: string, vendor: string) {
    Alert.alert("Reject withdrawal?", `${vendor}'s balance will be freed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject", style: "destructive", onPress: async () => {
          setBusy(id);
          try { await rejectWithdrawal(id); await load(); }
          catch (e) { Alert.alert("Could not reject", e instanceof Error ? e.message : "Failed"); }
          finally { setBusy(null); }
        },
      },
    ]);
  }

  const lowFloat = data.float <= data.pendingTotal;
  const queue = data.withdrawals.filter((w) => w.status === "PENDING" || w.status === "APPROVED");
  const recent = data.withdrawals.filter((w) => w.status !== "PENDING" && w.status !== "APPROVED").slice(0, 20);

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Row gap={space.sm}>
        <StatCard label="Company float" value={naira(data.float)} tone={lowFloat ? "default" : "accent"} />
        <StatCard label="Pending" value={naira(data.pendingTotal)} hint={`${data.pendingCount} request${data.pendingCount === 1 ? "" : "s"}`} />
      </Row>
      {lowFloat && data.pendingCount > 0 && (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
          <Row gap={space.sm}><Ionicons name="warning" size={18} color={colors.warning} /><Txt variant="smallStrong" color={colors.warning}>Float is below pending payouts — top up before approving.</Txt></Row>
        </Card>
      )}

      <Txt variant="h3">Awaiting review</Txt>
      {queue.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="checkmark-done-outline" size={32} color={colors.mutedLight} />} title="Queue clear" subtitle="No withdrawals waiting for approval." /></Card>
      ) : queue.map((w) => (
        <Card key={w.id}>
          <Row justify="space-between">
            <Txt variant="bodyStrong">{w.vendor}</Txt>
            <Txt variant="bodyStrong">{naira(w.amount)}</Txt>
          </Row>
          <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>
            {w.bankName ?? "—"}{w.accountLast4 ? ` ••${w.accountLast4}` : ""} · {relativeDate(w.requestedAt)}
          </Txt>
          {w.failureReason ? <Txt variant="small" color={colors.destructive} style={{ marginTop: 2 }}>{w.failureReason}</Txt> : null}
          <Row gap={space.sm} style={{ marginTop: space.md }}>
            <View style={{ flex: 1 }}><Button title="Pay" small loading={busy === w.id} onPress={() => onApprove(w.id, w.vendor, w.amount)} icon={<Ionicons name="cash-outline" size={16} color="#fff" />} /></View>
            <View style={{ flex: 1 }}><Button title="Reject" small variant="secondary" disabled={busy === w.id} onPress={() => onReject(w.id, w.vendor)} /></View>
          </Row>
        </Card>
      ))}

      {recent.length > 0 && (
        <>
          <Txt variant="h3" style={{ marginTop: space.sm }}>Recent</Txt>
          {recent.map((w) => (
            <Card key={w.id}>
              <Row justify="space-between">
                <View style={{ flex: 1 }}>
                  <Txt variant="body">{w.vendor}</Txt>
                  <Txt variant="tiny" color={colors.mutedLight}>{relativeDate(w.requestedAt)}</Txt>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Txt variant="bodyStrong">{naira(w.amount)}</Txt>
                  <Badge label={w.status} status={w.status} />
                </View>
              </Row>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
