import { useCallback, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { getPurchase, type PurchaseDetail } from "../../lib/api";
import { Screen, Card, Txt, Row, Badge, StatCard, Loading, Divider } from "../../lib/ui";
import { colors, space } from "../../lib/theme";
import { naira, kg, shortDate } from "../../lib/format";

export default function PurchaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [b, setB] = useState<PurchaseDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setB(await getPurchase(id)); } catch { setB(null); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (b === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Card>
        <Row justify="space-between">
          <Txt variant="h3">{b.supplier.name}</Txt>
          <Badge label={b.status} status={b.status} />
        </Row>
        <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>{b.lotNo}</Txt>
        {b.supplier.phone ? <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: 2 }}>{b.supplier.phone}</Txt> : null}
      </Card>

      <Row gap={space.sm}>
        <StatCard label={b.scaledIn ? "Scaled weight" : "Field estimate"} value={kg(b.scaledIn ? b.kg : (b.fieldEstKg ?? 0))} hint={b.variancePct != null ? `${b.variancePct >= 0 ? "+" : ""}${b.variancePct.toFixed(1)}% vs est` : (b.scaledIn ? undefined : "pending")} />
        <StatCard label="Landed ₦/kg" value={b.landed != null ? naira(b.landed) : "—"} />
      </Row>
      <Row gap={space.sm}>
        <StatCard label="Material cost" value={naira(b.materialCost)} />
        <StatCard label="Outstanding" value={naira(b.outstanding)} tone={b.outstanding > 0 ? "default" : "accent"} />
      </Row>

      {b.items.length > 0 && (
        <Card>
          <Txt variant="smallStrong" style={{ marginBottom: 4 }}>Scaled-in materials</Txt>
          {b.items.map((it, i) => (
            <View key={i}>
              {i > 0 && <Divider />}
              <Row justify="space-between" style={{ paddingVertical: space.sm }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Txt variant="body">{it.name}</Txt>
                  <Txt variant="tiny" color={colors.mutedLight}>{kg(it.weightKg)} × {naira(it.pricePerKg)}/kg</Txt>
                </View>
                <Txt variant="bodyStrong">{naira(it.amount)}</Txt>
              </Row>
            </View>
          ))}
        </Card>
      )}

      {b.expenses.length > 0 && (
        <Card>
          <Txt variant="smallStrong" style={{ marginBottom: 4 }}>Linked expenses</Txt>
          {b.expenses.map((e, i) => (
            <View key={i}>
              {i > 0 && <Divider />}
              <Row justify="space-between" style={{ paddingVertical: space.sm }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Txt variant="body">{e.category}</Txt>
                  <Txt variant="tiny" color={colors.mutedLight}>{e.description ?? shortDate(e.incurredAt)}</Txt>
                </View>
                <Txt variant="bodyStrong">{naira(e.amount)}</Txt>
              </Row>
            </View>
          ))}
        </Card>
      )}

      <Txt variant="tiny" color={colors.mutedLight}>Scale-in and supplier payments are on the web app.</Txt>
    </Screen>
  );
}
