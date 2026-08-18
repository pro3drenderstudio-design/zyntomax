import { useCallback, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getInventory, type Inventory, type MaterialStock } from "../lib/api";
import { Screen, Card, Txt, Row, StatCard, EmptyState, Loading } from "../lib/ui";
import { colors, space, radius } from "../lib/theme";
import { kg } from "../lib/format";

export default function InventoryScreen() {
  const router = useRouter();
  const [inv, setInv] = useState<Inventory | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setInv(await getInventory()); } catch { setInv(null); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (inv === null) return <Loading />;

  const Chip = ({ m }: { m: MaterialStock }) => (
    <Pressable
      onPress={() => router.push(`/inventory/${m.materialId}` as never)}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 }}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color ?? colors.mutedLight }} />
      <Txt variant="small">{m.name}</Txt>
      <Txt variant="smallStrong">{kg(m.kg)}</Txt>
    </Pressable>
  );

  const Section = ({ title, items }: { title: string; items: MaterialStock[] }) =>
    items.length === 0 ? null : (
      <View style={{ gap: space.sm }}>
        <Txt variant="smallStrong" color={colors.muted}>{title}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {items.map((m) => <Chip key={m.materialId} m={m} />)}
        </View>
      </View>
    );

  const empty = inv.raw.length === 0 && inv.waiting.length === 0 && inv.active.length === 0 && inv.finished.length === 0;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Row gap={space.sm}>
        <StatCard label="Raw intake" value={kg(inv.totals.raw)} />
        <StatCard label="In processing" value={kg(inv.totals.waiting + inv.totals.active)} />
      </Row>
      <StatCard label="Finished goods" value={kg(inv.totals.finished)} tone="accent" />

      {empty ? (
        <Card><EmptyState icon={<Ionicons name="layers-outline" size={32} color={colors.mutedLight} />} title="No stock on hand" subtitle="Scale in raw material or complete a job to build inventory." /></Card>
      ) : (
        <>
          <Section title="Raw material" items={inv.raw} />
          <Section title="Waiting for the next stage" items={inv.waiting} />
          {inv.active.map((s) => <Section key={s.stageId} title={`Being worked · ${s.stageName}`} items={s.materials} />)}
          <Section title="Finished goods" items={inv.finished} />
        </>
      )}
    </Screen>
  );
}
