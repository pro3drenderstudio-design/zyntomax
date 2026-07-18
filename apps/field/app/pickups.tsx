import { useCallback, useState } from "react";
import { ScrollView, Text, View, StyleSheet, RefreshControl, Linking } from "react-native";
import { useFocusEffect } from "expo-router";
import { getPickups, type Pickup } from "../lib/api";
import { navigateTo } from "../lib/navigate";
import { Card, Button } from "../lib/ui";
import { useLocationPing } from "../lib/use-location-ping";
import { colors } from "../lib/theme";

export default function PickupsScreen() {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLocationPing(undefined, true); // share location while browsing pickups

  const load = useCallback(async () => {
    try {
      setPickups(await getPickups());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load pickups");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      {error && <Card style={{ marginBottom: 12 }}><Text style={{ color: colors.destructive }}>{error}</Text></Card>}
      {pickups.length === 0 && !error && (
        <Card><Text style={{ color: colors.muted, textAlign: "center", paddingVertical: 12 }}>No pending pickup requests.</Text></Card>
      )}
      {pickups.map((p) => (
        <Card key={p.id} style={{ marginBottom: 10 }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.vendor.name}</Text>
              <Text style={styles.meta}>
                {p.vendor.locality ?? "—"} · ~{p.estWeightKg} kg
              </Text>
              {p.vendor.address ? <Text style={styles.meta}>{p.vendor.address}</Text> : null}
            </View>
          </View>
          <View style={styles.actions}>
            {p.vendor.lat != null && p.vendor.lng != null ? (
              <Button title="Navigate" onPress={() => navigateTo(p.vendor.lat!, p.vendor.lng!, p.vendor.name)} />
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12 }}>No pinned location</Text>
            )}
            <View style={{ height: 8 }} />
            <Button title="Call vendor" variant="secondary" onPress={() => Linking.openURL(`tel:${p.vendor.phone}`)} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 1 },
  actions: { marginTop: 10 },
});
