import { useCallback, useState } from "react";
import { View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getSales, type SalesData } from "../lib/api";
import { Screen, Card, Txt, Row, Badge, StatCard, EmptyState, Loading } from "../lib/ui";
import { colors, space } from "../lib/theme";
import { naira, shortDate } from "../lib/format";

export default function SalesScreen() {
  const router = useRouter();
  const [data, setData] = useState<SalesData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await getSales()); } catch { setData(null); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (data === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <StatCard label="Outstanding receivables" value={naira(data.outstandingTotal)} tone={data.outstandingTotal > 0 ? "default" : "accent"} />
      <Row gap={space.sm}>
        <StatCard label="Current" value={naira(data.aging.current)} />
        <StatCard label="1–30d" value={naira(data.aging.d1_30)} />
      </Row>
      <Row gap={space.sm}>
        <StatCard label="31–60d" value={naira(data.aging.d31_60)} />
        <StatCard label="60d+" value={naira(data.aging.d60plus)} hint={data.aging.d60plus > 0 ? "chase these" : undefined} />
      </Row>

      <Txt variant="h3">Recent sales</Txt>
      {data.orders.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="cart-outline" size={32} color={colors.mutedLight} />} title="No sales yet" /></Card>
      ) : data.orders.map((o) => (
        <Card key={o.id} onPress={() => router.push(`/sales/${o.id}` as never)}>
          <Row justify="space-between">
            <Txt variant="bodyStrong">{o.customer}</Txt>
            <Txt variant="bodyStrong">{naira(o.total)}</Txt>
          </Row>
          <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>
            {o.orderNo}{o.itemNames.length ? ` · ${o.itemNames.join(", ")}` : ""}{o.itemCount > 2 ? ` +${o.itemCount - 2}` : ""}
          </Txt>
          <Row justify="space-between" style={{ marginTop: 6 }}>
            <Txt variant="tiny" color={colors.mutedLight}>{o.invoiceNo ?? "No invoice"} · {shortDate(o.createdAt)}</Txt>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Badge label={o.status} status={o.status} />
              {o.invoiceStatus !== "—" ? <Badge label={o.invoiceStatus} status={o.invoiceStatus} /> : null}
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
