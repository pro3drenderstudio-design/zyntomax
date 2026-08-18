import { useCallback, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { getSale, type SaleDetail } from "../../lib/api";
import { Screen, Card, Txt, Row, Badge, StatCard, Loading, Divider } from "../../lib/ui";
import { colors, space } from "../../lib/theme";
import { naira, kg, shortDate } from "../../lib/format";

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [o, setO] = useState<SaleDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setO(await getSale(id)); } catch { setO(null); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (o === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Card>
        <Row justify="space-between">
          <Txt variant="h3">{o.customer.name}</Txt>
          <Badge label={o.status} status={o.status} />
        </Row>
        <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>{o.orderNo} · {shortDate(o.createdAt)}</Txt>
        {o.customer.phone ? <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: 2 }}>{o.customer.phone}</Txt> : null}
        {(o.driverName || o.truckNo || o.waybillNo) ? (
          <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: 4 }}>
            {[o.driverName, o.truckNo, o.waybillNo ? `WB ${o.waybillNo}` : null].filter(Boolean).join(" · ")}
          </Txt>
        ) : null}
      </Card>

      <Row gap={space.sm}>
        <StatCard label="Sale total" value={naira(o.total)} />
        {o.invoice ? <StatCard label="Outstanding" value={naira(o.invoice.outstanding)} tone={o.invoice.outstanding > 0 ? "default" : "accent"} /> : <StatCard label="Invoice" value="—" />}
      </Row>

      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 4 }}>Lines</Txt>
        {o.lines.map((l, i) => (
          <View key={i}>
            {i > 0 && <Divider />}
            <Row justify="space-between" style={{ paddingVertical: space.sm }}>
              <View style={{ flex: 1, paddingRight: space.sm }}>
                <Txt variant="body">{l.name}</Txt>
                <Txt variant="tiny" color={colors.mutedLight}>{l.isInventory ? "Finished goods" : "Non-inventory"} · {kg(l.qtyKg)} × {naira(l.unitPrice)}</Txt>
              </View>
              <Txt variant="bodyStrong">{naira(l.lineTotal)}</Txt>
            </Row>
          </View>
        ))}
      </Card>

      {o.invoice && (
        <Card>
          <Row justify="space-between">
            <Txt variant="smallStrong">Invoice {o.invoice.invoiceNo}</Txt>
            <Badge label={o.invoice.status} status={o.invoice.status} />
          </Row>
          <Row justify="space-between" style={{ marginTop: space.sm }}>
            <Txt variant="small" color={colors.muted}>Paid</Txt>
            <Txt variant="body">{naira(o.invoice.paid)} of {naira(o.invoice.amount)}</Txt>
          </Row>
          <Row justify="space-between" style={{ marginTop: 2 }}>
            <Txt variant="small" color={colors.muted}>Due</Txt>
            <Txt variant="small">{shortDate(o.invoice.dueDate)}</Txt>
          </Row>
          {o.invoice.payments.length > 0 && <Divider />}
          {o.invoice.payments.map((p, i) => (
            <Row key={i} justify="space-between" style={{ paddingVertical: 6 }}>
              <Txt variant="tiny" color={colors.mutedLight}>{p.method}{p.reference ? ` · ${p.reference}` : ""} · {shortDate(p.paidAt)}</Txt>
              <Txt variant="small">{naira(p.amount)}</Txt>
            </Row>
          ))}
        </Card>
      )}

      <Txt variant="tiny" color={colors.mutedLight}>Recording payments and deliveries is on the web app.</Txt>
    </Screen>
  );
}
