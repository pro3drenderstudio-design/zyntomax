import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getHome, type VendorHome } from "../lib/api";
import { Screen, Card, Txt, Row, EmptyState, Loading, SectionHeader } from "../lib/ui";
import { colors, space, radius } from "../lib/theme";
import { naira, kg, shortDate } from "../lib/format";

const PALETTE = ["#008037", "#2563eb", "#9333ea", "#eab308", "#dc2626", "#0891b2", "#92400e", "#64748b"];

export default function HistoryScreen() {
  const [home, setHome] = useState<VendorHome | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { try { setHome(await getHome()); } catch { /* keep */ } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const breakdown = useMemo(() => {
    if (!home) return [];
    const map = new Map<string, { material: string; kg: number; amount: number }>();
    for (const c of home.collections) {
      const cur = map.get(c.material) ?? { material: c.material, kg: 0, amount: 0 };
      cur.kg += c.weightKg; cur.amount += c.amount;
      map.set(c.material, cur);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [home]);

  if (!home) return <Loading />;

  const totalKg = breakdown.reduce((s, b) => s + b.kg, 0);
  const totalAmt = breakdown.reduce((s, b) => s + b.amount, 0);

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Row gap={space.md}>
        <Card style={{ flex: 1 }}>
          <Txt variant="tiny" color={colors.muted}>TOTAL RECYCLED</Txt>
          <Txt variant="h1">{kg(totalKg)}</Txt>
        </Card>
        <Card style={{ flex: 1 }}>
          <Txt variant="tiny" color={colors.muted}>TOTAL EARNED</Txt>
          <Txt variant="h1" color={colors.accent}>{naira(totalAmt)}</Txt>
        </Card>
      </Row>

      {breakdown.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="stats-chart-outline" size={32} color={colors.mutedLight} />} title="No sales yet" subtitle="Your recyclable sales and breakdown will show up here." /></Card>
      ) : (
        <>
          <View>
            <SectionHeader title="By material" />
            <Card>
              {breakdown.map((b, i) => {
                const pct = totalAmt > 0 ? (b.amount / totalAmt) * 100 : 0;
                return (
                  <View key={b.material} style={{ marginBottom: i < breakdown.length - 1 ? space.md : 0 }}>
                    <Row justify="space-between">
                      <Row gap={space.sm}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PALETTE[i % PALETTE.length] }} />
                        <Txt variant="bodyStrong">{b.material}</Txt>
                      </Row>
                      <Txt variant="bodyStrong" color={colors.accent}>{naira(b.amount)}</Txt>
                    </Row>
                    <View style={{ height: 8, backgroundColor: colors.bgAlt, borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
                      <View style={{ height: 8, width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length], borderRadius: 4 }} />
                    </View>
                    <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>{kg(b.kg)} · {pct.toFixed(0)}%</Txt>
                  </View>
                );
              })}
            </Card>
          </View>

          <View>
            <SectionHeader title="All collections" />
            <Card style={{ padding: space.sm }}>
              {home.collections.map((c, i) => (
                <View key={c.id}>
                  <Row justify="space-between" style={{ padding: space.md }}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">{c.material}</Txt>
                      <Txt variant="small" color={colors.muted}>{kg(c.weightKg)} · {shortDate(c.date)}</Txt>
                    </View>
                    <Txt variant="bodyStrong" color={colors.accent}>{naira(c.amount)}</Txt>
                  </Row>
                  {i < home.collections.length - 1 && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: space.md }} />}
                </View>
              ))}
            </Card>
          </View>
        </>
      )}
    </Screen>
  );
}
