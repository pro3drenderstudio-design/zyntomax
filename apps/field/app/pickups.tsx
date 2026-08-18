import { useCallback, useState } from "react";
import { View, Linking } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getPickups, type Pickup } from "../lib/api";
import { navigateTo } from "../lib/navigate";
import { useLocationPing } from "../lib/use-location-ping";
import { Screen, Card, Txt, Row, Button, Badge, EmptyState, Loading } from "../lib/ui";
import { MiniMap, type MapPoint } from "../lib/map";
import { colors, space } from "../lib/theme";
import { kg } from "../lib/format";

export default function PickupsScreen() {
  const [pickups, setPickups] = useState<Pickup[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");

  useLocationPing(undefined, true);
  const load = useCallback(async () => { try { setPickups(await getPickups()); } catch { setPickups([]); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (pickups === null) return <Loading />;

  const pins: MapPoint[] = pickups
    .filter((p) => p.vendor.lat != null && p.vendor.lng != null)
    .map((p) => ({ lat: p.vendor.lat!, lng: p.vendor.lng!, label: p.vendor.name, color: p.status === "PENDING" ? "#d97706" : "#2563eb" }));

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Row gap={space.sm}>
        <View style={{ flex: 1 }}><Button title="List" small variant={view === "list" ? "primary" : "secondary"} onPress={() => setView("list")} /></View>
        <View style={{ flex: 1 }}><Button title="Map" small variant={view === "map" ? "primary" : "secondary"} onPress={() => setView("map")} /></View>
      </Row>

      {view === "map" ? (
        pins.length === 0 ? (
          <Card><EmptyState icon={<Ionicons name="map-outline" size={32} color={colors.mutedLight} />} title="No pinned pickups" subtitle="Pickups with a location will appear on the map." /></Card>
        ) : <MiniMap points={pins} height={420} />
      ) : pickups.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="cube-outline" size={32} color={colors.mutedLight} />} title="No pickup requests" subtitle="New vendor pickup requests will show up here." /></Card>
      ) : (
        pickups.map((p) => (
          <Card key={p.id}>
            <Row justify="space-between">
              <Txt variant="bodyStrong">{p.vendor.name}</Txt>
              <Badge label={p.status} status={p.status} />
            </Row>
            <Txt variant="small" color={colors.muted}>{p.vendor.locality ?? "—"}{p.estWeightKg ? ` · ~${kg(p.estWeightKg)}` : ""}</Txt>
            {p.vendor.address ? <Txt variant="small" color={colors.muted}>{p.vendor.address}</Txt> : null}
            <Row gap={space.sm} style={{ marginTop: space.md }}>
              <View style={{ flex: 1 }}><Button title="Call" small variant="secondary" icon={<Ionicons name="call-outline" size={16} color={colors.text} />} onPress={() => Linking.openURL(`tel:${p.vendor.phone}`)} /></View>
              {p.vendor.lat != null && p.vendor.lng != null && (
                <View style={{ flex: 1 }}><Button title="Navigate" small icon={<Ionicons name="navigate-outline" size={16} color="#fff" />} onPress={() => navigateTo(p.vendor.lat!, p.vendor.lng!, p.vendor.name)} /></View>
              )}
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
