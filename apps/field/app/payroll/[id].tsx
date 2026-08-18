import { useCallback, useState } from "react";
import { View, Alert } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getPayrollRun, payPayrollItem, type PayrollRunDetail } from "../../lib/api";
import { Screen, Card, Txt, Row, Badge, Button, StatCard, Loading } from "../../lib/ui";
import { colors, space } from "../../lib/theme";
import { naira, shortDate } from "../../lib/format";

export default function PayrollRunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRun(await getPayrollRun(id)); } catch { setRun(null); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (run === null) return <Loading />;

  async function pay(itemId: string, staff: string, amount: number) {
    Alert.alert("Mark paid?", `Confirm ${naira(amount)} paid to ${staff}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark paid", onPress: async () => {
          setBusy(itemId);
          try { await payPayrollItem(itemId); await load(); }
          catch (e) { Alert.alert("Failed", e instanceof Error ? e.message : "Could not mark paid"); }
          finally { setBusy(null); }
        },
      },
    ]);
  }

  const unpaid = run.items.filter((i) => !i.paid).length;

  return (
    <Screen>
      <Card>
        <Row justify="space-between">
          <Txt variant="h3">Week of {shortDate(run.weekStart)}</Txt>
          <Badge label={run.status} status={run.status} />
        </Row>
        <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>{run.site}</Txt>
      </Card>

      <Row gap={space.sm}>
        <StatCard label="Net total" value={naira(run.netTotal)} tone="accent" />
        <StatCard label="Staff" value={String(run.items.length)} hint={unpaid > 0 ? `${unpaid} unpaid` : "all paid"} />
      </Row>

      {run.items.map((i) => (
        <Card key={i.id}>
          <Row justify="space-between">
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{i.staff}</Txt>
              <Txt variant="tiny" color={colors.mutedLight}>{i.staffNo}</Txt>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Txt variant="bodyStrong">{naira(i.netAmount)}</Txt>
              <Badge label={i.paid ? "Paid" : "Unpaid"} status={i.paid ? "PAID" : "PENDING"} />
            </View>
          </Row>
          <Txt variant="tiny" color={colors.muted} style={{ marginTop: 6 }}>
            Comm {naira(i.commissionAmount)}{i.baseAmount ? ` · base ${naira(i.baseAmount)}` : ""}
            {i.advanceDeduction ? ` · adv −${naira(i.advanceDeduction)}` : ""}
            {i.discrepancyDeduction ? ` · disc −${naira(i.discrepancyDeduction)}` : ""}
          </Txt>
          {run.canPay && !i.paid && (
            <View style={{ marginTop: space.sm }}>
              <Button title="Mark paid" small variant="secondary" loading={busy === i.id} onPress={() => pay(i.id, i.staff, i.netAmount)} />
            </View>
          )}
        </Card>
      ))}

      {!run.canPay && <Txt variant="tiny" color={colors.mutedLight}>Only finance can mark payslips paid.</Txt>}
    </Screen>
  );
}
