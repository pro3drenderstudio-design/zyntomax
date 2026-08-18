import { useCallback, useState } from "react";
import { View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getPurchases, type PurchaseRow } from "../lib/api";
import { Screen, Card, Txt, Row, Badge, EmptyState, Loading } from "../lib/ui";
import { colors, space } from "../lib/theme";
import { naira, kg, shortDate } from "../lib/format";

export default function PurchasesScreen() {
  const router = useRouter();
  const [batches, setBatches] = useState<PurchaseRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setBatches((await getPurchases()).batches); } catch { setBatches([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (batches === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      {batches.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="cube-outline" size={32} color={colors.mutedLight} />} title="No purchase batches" /></Card>
      ) : batches.map((b) => (
        <Card key={b.id} onPress={() => router.push(`/purchases/${b.id}` as never)}>
          <Row justify="space-between">
            <Txt variant="bodyStrong">{b.supplier}</Txt>
            <Badge label={b.status} status={b.status} />
          </Row>
          <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>
            {b.lotNo} · {b.scaledIn ? kg(b.kg) : "Not scaled in"}
          </Txt>
          <Row justify="space-between" style={{ marginTop: 6 }}>
            <Txt variant="tiny" color={colors.mutedLight}>{shortDate(b.createdAt)}</Txt>
            <Txt variant="small">{naira(b.materialCost)}{b.landed != null ? ` · ${naira(b.landed)}/kg` : ""}</Txt>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
