import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getMyEarnings, type MyEarnings } from "../lib/api";
import { Screen, Card, Txt, Row, Badge, StatCard, EmptyState, Loading, Divider } from "../lib/ui";
import { colors, space } from "../lib/theme";
import { naira, kg, shortDate } from "../lib/format";

const WAGE_LABEL: Record<string, string> = {
  COMMISSION: "Commission (piece-rate)", SALARY: "Weekly salary", COMMISSION_PLUS_BASE: "Commission + base",
};

export default function EarningsScreen() {
  const [data, setData] = useState<MyEarnings | null>(null);
  const [notStaff, setNotStaff] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await getMyEarnings()); setNotStaff(false); }
    catch { setNotStaff(true); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (notStaff) {
    return (
      <Screen>
        <Card><EmptyState icon={<Ionicons name="cash-outline" size={32} color={colors.mutedLight} />} title="No earnings profile" subtitle="Your account isn't linked to a staff wage profile." /></Card>
      </Screen>
    );
  }
  if (data === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <StatCard label="Earned this period (before deductions)" value={naira(data.earnedAmount)} tone="accent" />
      <Row gap={space.sm}>
        <StatCard label="Commission" value={naira(data.commissionAmount)} hint={`${data.jobCount} job${data.jobCount === 1 ? "" : "s"}`} />
        <StatCard label="Base" value={naira(data.baseAmount)} hint={WAGE_LABEL[data.wageModel] ?? data.wageModel} />
      </Row>
      {data.outstandingAdvance > 0 && (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
          <Row gap={space.sm}><Ionicons name="information-circle" size={18} color={colors.warning} /><Txt variant="small" color={colors.warning}>Advance to repay: {naira(data.outstandingAdvance)} (deducted at payroll, capped)</Txt></Row>
        </Card>
      )}

      {data.jobs.length > 0 && (
        <Card>
          <Txt variant="smallStrong" style={{ marginBottom: 4 }}>Jobs counted this period</Txt>
          {data.jobs.map((j, i) => (
            <View key={j.id}>
              {i > 0 && <Divider />}
              <Row justify="space-between" style={{ paddingVertical: space.sm }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Txt variant="body">{j.stage}</Txt>
                  <Txt variant="tiny" color={colors.mutedLight}>{j.material} · {kg(j.basisKg)}{j.completedAt ? ` · ${shortDate(j.completedAt)}` : ""}</Txt>
                </View>
                <Txt variant="bodyStrong">{naira(j.wage)}</Txt>
              </Row>
            </View>
          ))}
        </Card>
      )}

      {data.payslips.length > 0 && (
        <Card>
          <Txt variant="smallStrong" style={{ marginBottom: 4 }}>Past payslips</Txt>
          {data.payslips.map((p, i) => (
            <View key={p.id}>
              {i > 0 && <Divider />}
              <Row justify="space-between" style={{ paddingVertical: space.sm }}>
                <Txt variant="body">Week of {shortDate(p.weekStart)}</Txt>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Txt variant="bodyStrong">{naira(p.netAmount)}</Txt>
                  <Badge label={p.paid ? "Paid" : "Unpaid"} status={p.paid ? "PAID" : "PENDING"} />
                </View>
              </Row>
            </View>
          ))}
        </Card>
      )}

      <Txt variant="tiny" color={colors.mutedLight}>Live estimate of un-payrolled work. Final pay applies advance and discrepancy deductions.</Txt>
    </Screen>
  );
}
