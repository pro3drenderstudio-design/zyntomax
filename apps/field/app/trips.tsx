import { useCallback, useState } from "react";
import { ScrollView, Text, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api, type TripSummary } from "../lib/api";
import { Card } from "../lib/ui";
import { colors } from "../lib/theme";

export default function TripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ trips: TripSummary[] }>("/api/mobile/trips");
      setTrips(data.trips);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load trips");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {error && (
        <Card style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.destructive }}>{error}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            Weigh-ins recorded offline still queue in Pending sync.
          </Text>
        </Card>
      )}
      {trips.length === 0 && !error && (
        <Card>
          <Text style={{ color: colors.muted, textAlign: "center", paddingVertical: 12 }}>
            No active trips assigned to you. Ops creates trips in the admin.
          </Text>
        </Card>
      )}
      {trips.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => router.push(`/trip/${t.id}` as never)}
          style={({ pressed }) => [styles.trip, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={styles.tripTitle}>
            {t.locality ?? "Route"} — {new Date(t.date).toLocaleDateString("en-NG")}
          </Text>
          <Text style={styles.tripMeta}>
            {t.status.replace(/_/g, " ")} · {t.weighInCount} weigh-ins ·{" "}
            {t.totalKg.toLocaleString()} kg · ₦{t.totalAmount.toLocaleString()}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  trip: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    padding: 16,
    marginBottom: 10,
  },
  tripTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  tripMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
