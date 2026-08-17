import { useCallback, useState } from "react";
import { View, Image, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getPickups, type VendorPickup } from "../../lib/api";
import { Screen, Card, Txt, Row, Badge, Button, EmptyState, Loading } from "../../lib/ui";
import { colors, space, radius } from "../../lib/theme";
import { kg, relativeDate } from "../../lib/format";
import { useI18n } from "../../lib/i18n";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting pickup",
  SCHEDULED: "Scheduled",
  COLLECTED: "Collected",
  CANCELLED: "Cancelled",
};

export default function PickupsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [pickups, setPickups] = useState<VendorPickup[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setPickups(await getPickups()); } catch { setPickups([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (pickups === null) return <Loading />;

  const hasOpen = pickups.some((p) => p.status === "PENDING" || p.status === "SCHEDULED");

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Button
        title={hasOpen ? t("open_request") : t("request_pickup")}
        icon={<Ionicons name="camera" size={18} color="#fff" />}
        onPress={() => router.push("/pickup/new")}
        disabled={hasOpen}
      />

      {pickups.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="cube-outline" size={32} color={colors.mutedLight} />} title={t("no_pickups")} subtitle="Tap “Request a pickup”, snap a photo of your recyclables, and we’ll schedule a collection." /></Card>
      ) : (
        pickups.map((p) => (
          <Card key={p.id} onPress={() => router.push(`/pickup/${p.id}`)}>
            <Row gap={space.md} align="flex-start">
              {p.photoUrl ? (
                <Image source={{ uri: p.photoUrl }} style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.bgAlt }} />
              ) : (
                <View style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.bgAlt, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="cube" size={26} color={colors.mutedLight} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Row justify="space-between">
                  <Badge label={STATUS_LABEL[p.status] ?? p.status} status={p.status} />
                  <Txt variant="small" color={colors.muted}>{relativeDate(p.createdAt)}</Txt>
                </Row>
                <Txt variant="bodyStrong" style={{ marginTop: 6 }}>
                  {p.estWeightKg ? `~${kg(p.estWeightKg)}` : "Weight to be measured"}
                </Txt>
                {p.trip?.collector ? (
                  <Txt variant="small" color={colors.muted}>Collector: {p.trip.collector}{p.trip.vehicle ? ` · ${p.trip.vehicle}` : ""}</Txt>
                ) : p.status === "PENDING" ? (
                  <Txt variant="small" color={colors.muted}>We’ll assign a collector soon</Txt>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedLight} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
