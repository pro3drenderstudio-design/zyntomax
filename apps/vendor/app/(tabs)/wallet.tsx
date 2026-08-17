import { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getHome, type VendorHome } from "../../lib/api";
import { Screen, Card, Txt, Row, Badge, EmptyState, Loading, SectionHeader } from "../../lib/ui";
import { colors, space, radius, type as t } from "../../lib/theme";
import { naira, shortDate } from "../../lib/format";

export default function WalletScreen() {
  const [home, setHome] = useState<VendorHome | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { try { setHome(await getHome()); } catch { /* keep */ } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!home) return <Loading />;

  const paid = home.payments.filter((p) => p.status === "SUCCESS").reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, home.lifetimeNaira - paid);

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      {/* Balance card */}
      <View style={{ backgroundColor: colors.accent, borderRadius: radius.lg, padding: space.lg }}>
        <Txt variant="tiny" color="rgba(255,255,255,0.85)">AVAILABLE TO WITHDRAW</Txt>
        <Text style={[t.display, { color: "#fff", marginTop: 4 }]} accessibilityLabel={`Balance ${naira(outstanding)}`}>{naira(outstanding)}</Text>
        <Row gap={space.sm} style={{ marginTop: space.md }}>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.md, padding: space.md }}>
            <Txt variant="tiny" color="rgba(255,255,255,0.8)">LIFETIME EARNED</Txt>
            <Txt variant="h3" color="#fff">{naira(home.lifetimeNaira)}</Txt>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.md, padding: space.md }}>
            <Txt variant="tiny" color="rgba(255,255,255,0.8)">PAID OUT</Txt>
            <Txt variant="h3" color="#fff">{naira(paid)}</Txt>
          </View>
        </Row>
      </View>

      <Card style={{ backgroundColor: colors.infoSoft, borderColor: colors.infoSoft }}>
        <Row gap={space.sm} align="flex-start">
          <Ionicons name="information-circle" size={18} color={colors.info} />
          <Txt variant="small" color={colors.info} style={{ flex: 1 }}>
            Bank withdrawals are rolling out soon. For now your balance is settled by our team — you’ll get an SMS when a payment lands.
          </Txt>
        </Row>
      </Card>

      {/* Payment history */}
      <View>
        <SectionHeader title="Payment history" />
        {home.payments.length === 0 ? (
          <Card><EmptyState icon={<Ionicons name="wallet-outline" size={32} color={colors.mutedLight} />} title="No payments yet" subtitle="Payments appear here once your recyclables are collected and settled." /></Card>
        ) : (
          <Card style={{ padding: space.sm }}>
            {home.payments.map((p, i) => (
              <View key={p.id}>
                <Row justify="space-between" style={{ padding: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{naira(p.amount)}</Txt>
                    <Txt variant="small" color={colors.muted}>{shortDate(p.date)}{p.reference ? ` · ${p.reference}` : ""}</Txt>
                  </View>
                  <Badge label={p.status} status={p.status} />
                </Row>
                {i < home.payments.length - 1 && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: space.md }} />}
              </View>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
