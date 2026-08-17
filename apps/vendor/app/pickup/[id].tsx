import { useCallback, useState } from "react";
import { View, Image } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getPickups, type VendorPickup } from "../../lib/api";
import { Screen, Card, Txt, Row, Badge, Loading, EmptyState } from "../../lib/ui";
import { colors, space, radius } from "../../lib/theme";
import { kg, shortDate, relativeDate } from "../../lib/format";

const STEPS = [
  { key: "PENDING", label: "Requested", desc: "We received your request", icon: "checkmark-circle" as const },
  { key: "SCHEDULED", label: "Scheduled", desc: "A collector is on the way", icon: "car" as const },
  { key: "COLLECTED", label: "Collected", desc: "Your recyclables were weighed in", icon: "cube" as const },
];
const ORDER = ["PENDING", "SCHEDULED", "COLLECTED"];

export default function PickupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pickup, setPickup] = useState<VendorPickup | null | undefined>(undefined);

  const load = useCallback(async () => {
    try { const all = await getPickups(); setPickup(all.find((p) => p.id === id) ?? null); }
    catch { setPickup(null); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (pickup === undefined) return <Loading />;
  if (!pickup) return <Screen><Card><EmptyState icon={<Ionicons name="alert-circle-outline" size={32} color={colors.mutedLight} />} title="Pickup not found" /></Card></Screen>;

  const cancelled = pickup.status === "CANCELLED";
  const currentIdx = ORDER.indexOf(pickup.status);

  return (
    <Screen>
      {pickup.photoUrl && (
        <Image source={{ uri: pickup.photoUrl }} style={{ width: "100%", height: 220, borderRadius: radius.lg, backgroundColor: colors.bgAlt }} />
      )}

      <Card>
        <Row justify="space-between">
          <View>
            <Txt variant="tiny" color={colors.muted}>PICKUP REQUEST</Txt>
            <Txt variant="h3">{pickup.estWeightKg ? `~${kg(pickup.estWeightKg)}` : "Weight to be measured"}</Txt>
          </View>
          <Badge label={pickup.status} status={pickup.status} />
        </Row>
        {pickup.note ? <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>“{pickup.note}”</Txt> : null}
        <Txt variant="small" color={colors.muted} style={{ marginTop: space.xs }}>Requested {relativeDate(pickup.createdAt)}</Txt>
      </Card>

      {cancelled ? (
        <Card style={{ backgroundColor: colors.destructiveSoft, borderColor: colors.destructiveSoft }}>
          <Txt variant="bodyStrong" color={colors.destructive}>This request was cancelled.</Txt>
        </Card>
      ) : (
        <Card>
          <Txt variant="h3" style={{ marginBottom: space.md }}>Status</Txt>
          {STEPS.map((step, i) => {
            const done = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <Row key={step.key} gap={space.md} align="flex-start" style={{ marginBottom: i < STEPS.length - 1 ? 0 : 0 }}>
                <View style={{ alignItems: "center" }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: done ? colors.accent : colors.bgAlt, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={step.icon} size={18} color={done ? "#fff" : colors.mutedLight} />
                  </View>
                  {i < STEPS.length - 1 && <View style={{ width: 2, height: 28, backgroundColor: i < currentIdx ? colors.accent : colors.border }} />}
                </View>
                <View style={{ flex: 1, paddingBottom: space.md }}>
                  <Txt variant="bodyStrong" color={active ? colors.accent : done ? colors.text : colors.muted}>{step.label}</Txt>
                  <Txt variant="small" color={colors.muted}>{step.desc}</Txt>
                </View>
              </Row>
            );
          })}
        </Card>
      )}

      {pickup.trip && (
        <Card>
          <Txt variant="tiny" color={colors.muted}>ASSIGNED COLLECTION</Txt>
          <Row justify="space-between" style={{ marginTop: space.xs }}>
            <View>
              <Txt variant="bodyStrong">{pickup.trip.collector ?? "Collector"}</Txt>
              <Txt variant="small" color={colors.muted}>{pickup.trip.vehicle ?? "Vehicle"} · {shortDate(pickup.trip.date)}</Txt>
            </View>
            <Ionicons name="car" size={22} color={colors.accent} />
          </Row>
          <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: space.sm }}>Live collector location is coming in the next update.</Txt>
        </Card>
      )}
    </Screen>
  );
}
