import { useCallback, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getMaterial, type MaterialDetail } from "../../lib/api";
import { Screen, Card, Txt, Row, Badge, StatCard, EmptyState, Loading, Divider } from "../../lib/ui";
import { colors, space } from "../../lib/theme";
import { kg, relativeDate } from "../../lib/format";

export default function MaterialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<MaterialDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setD(await getMaterial(id)); } catch { setD(null); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (d === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Card>
        <Row gap={space.sm}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: d.material.color ?? colors.mutedLight }} />
          <Txt variant="h3">{d.material.name}</Txt>
        </Row>
        <Row gap={space.xs} style={{ marginTop: 6 }}>
          <Badge label={d.material.kind} />
        </Row>
      </Card>

      <StatCard label="Available at home store" value={kg(d.availableKg)} tone="accent" />

      <Txt variant="h3">Movement history</Txt>
      {d.movements.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="swap-horizontal-outline" size={32} color={colors.mutedLight} />} title="No movements yet" /></Card>
      ) : (
        <Card>
          {d.movements.map((m, i) => (
            <View key={`${m.createdAt}-${i}`}>
              {i > 0 && <Divider />}
              <Row justify="space-between" style={{ paddingVertical: space.sm }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Txt variant="body">{m.from ?? "—"} → {m.to ?? "—"}</Txt>
                  <Txt variant="tiny" color={colors.mutedLight}>
                    {m.note ?? m.refType}{m.by ? ` · ${m.by}` : ""} · {relativeDate(m.createdAt)}
                  </Txt>
                </View>
                <Txt variant="bodyStrong" color={m.weightKg >= 0 ? colors.success : colors.destructive}>
                  {m.weightKg >= 0 ? "+" : ""}{kg(m.weightKg)}
                </Txt>
              </Row>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
