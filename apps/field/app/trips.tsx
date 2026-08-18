import { useCallback, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type TripSummary } from "../lib/api";
import { Screen, Card, Txt, Row, Badge, EmptyState, Loading } from "../lib/ui";
import { colors, space } from "../lib/theme";
import { naira, kg, shortDate } from "../lib/format";

export default function TripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ trips: TripSummary[] }>("/api/mobile/trips");
      setTrips(data.trips); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load trips");
      setTrips((prev) => prev ?? []);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (trips === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      {error && (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
          <Txt variant="small" color={colors.warning}>{error} — offline weigh-ins still queue and sync later.</Txt>
        </Card>
      )}
      {trips.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="car-outline" size={32} color={colors.mutedLight} />} title="No active trips" subtitle="You have no trips in the field right now. Operations creates trips in the dashboard." /></Card>
      ) : (
        trips.map((t) => (
          <Card key={t.id} onPress={() => router.push(`/trip/${t.id}` as never)}>
            <Row justify="space-between">
              <Txt variant="bodyStrong">{t.locality ?? "Route"}</Txt>
              <Badge label={t.status.replace(/_/g, " ")} status={t.status} />
            </Row>
            <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>
              {shortDate(t.date)}{t.vehicle ? ` · ${t.vehicle}` : ""}
            </Txt>
            <Row gap={space.lg} style={{ marginTop: space.sm }}>
              <Txt variant="small" color={colors.muted}>{t.weighInCount} weigh-ins</Txt>
              <Txt variant="small" color={colors.muted}>{kg(t.totalKg)}</Txt>
              <Txt variant="smallStrong" color={colors.accent}>{naira(t.totalAmount)}</Txt>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
