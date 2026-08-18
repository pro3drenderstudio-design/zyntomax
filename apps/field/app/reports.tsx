import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { getReport, type Pnl } from "../lib/api";
import { Screen, Card, Txt, Row, StatCard, Loading, Divider } from "../lib/ui";
import { colors, space } from "../lib/theme";
import { naira, kg } from "../lib/format";

function line(label: string, value: number, opts?: { strong?: boolean; color?: string; negative?: boolean }) {
  return { label, value, ...opts };
}

export default function ReportsScreen() {
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setPnl(await getReport()); } catch { setPnl(null); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (pnl === null) return <Loading />;

  const monthLabel = new Date(pnl.period + "-01").toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  const rows = [
    line("Revenue (invoiced)", pnl.revenue, { strong: true }),
    line("Vendor collections", pnl.vendorCost, { negative: true }),
    line("Purchases", pnl.purchaseCost, { negative: true }),
    line("Direct expenses", pnl.directExpenses, { negative: true }),
    line("Wages", pnl.wages, { negative: true }),
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Txt variant="h3">{monthLabel}</Txt>
      <Row gap={space.sm}>
        <StatCard label="Gross profit" value={naira(pnl.grossProfit)} tone={pnl.grossProfit >= 0 ? "accent" : "default"} />
        <StatCard label="Net profit" value={naira(pnl.netProfit)} hint={`${kg(pnl.outputKg)} finished`} />
      </Row>

      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 4 }}>Profit &amp; loss</Txt>
        {rows.map((r, i) => (
          <View key={r.label}>
            {i > 0 && <Divider />}
            <Row justify="space-between" style={{ paddingVertical: 9 }}>
              <Txt variant={r.strong ? "bodyStrong" : "body"} color={colors.muted}>{r.label}</Txt>
              <Txt variant={r.strong ? "bodyStrong" : "body"} color={r.negative ? colors.destructive : colors.text}>
                {r.negative ? "−" : ""}{naira(r.value)}
              </Txt>
            </Row>
          </View>
        ))}
        <Divider />
        <Row justify="space-between" style={{ paddingVertical: 9 }}>
          <Txt variant="body" color={colors.muted}>Cost of goods</Txt>
          <Txt variant="body">{naira(pnl.cogs)}</Txt>
        </Row>
        <Divider />
        <Row justify="space-between" style={{ paddingVertical: 9 }}>
          <Txt variant="bodyStrong">Gross profit</Txt>
          <Txt variant="bodyStrong" color={pnl.grossProfit >= 0 ? colors.success : colors.destructive}>{naira(pnl.grossProfit)}</Txt>
        </Row>
        <Divider />
        <Row justify="space-between" style={{ paddingVertical: 9 }}>
          <Txt variant="body" color={colors.muted}>Operating expenses</Txt>
          <Txt variant="body" color={colors.destructive}>−{naira(pnl.opex)}</Txt>
        </Row>
        <Divider />
        <Row justify="space-between" style={{ paddingVertical: 9 }}>
          <Txt variant="bodyStrong">Net profit</Txt>
          <Txt variant="bodyStrong" color={pnl.netProfit >= 0 ? colors.success : colors.destructive}>{naira(pnl.netProfit)}</Txt>
        </Row>
      </Card>

      <Txt variant="tiny" color={colors.mutedLight}>Figures for the current month. Full reports and PDFs are on the web app.</Txt>
    </Screen>
  );
}
