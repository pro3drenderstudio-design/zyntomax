import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getRates, type RateItem } from "../lib/api";
import { Screen, Card, Txt, Row, EmptyState, Loading } from "../lib/ui";
import { colors, space } from "../lib/theme";
import { naira } from "../lib/format";

export default function RatesScreen() {
  const [rates, setRates] = useState<RateItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { setRates(await getRates()); } catch { setRates([]); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (rates === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Txt variant="small" color={colors.muted}>Today's prices we pay per kilogram. Rates can change — always check before a pickup.</Txt>
      {rates.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="pricetags-outline" size={32} color={colors.mutedLight} />} title="No rates published yet" subtitle="Check back soon." /></Card>
      ) : (
        <Card style={{ padding: space.sm }}>
          {rates.map((r, i) => (
            <View key={r.material}>
              <Row justify="space-between" style={{ padding: space.md }}>
                <Row gap={space.sm}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: r.color ?? colors.mutedLight }} />
                  <Txt variant="bodyStrong">{r.material}</Txt>
                </Row>
                <Txt variant="bodyStrong" color={colors.accent}>{naira(r.pricePerKg)}<Txt variant="small" color={colors.muted}>/kg</Txt></Txt>
              </Row>
              {i < rates.length - 1 && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: space.md }} />}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
