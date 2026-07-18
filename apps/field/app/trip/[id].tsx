import { useEffect, useState } from "react";
import { ScrollView, Text, View, StyleSheet, Alert, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import { loadBootstrap, type Bootstrap } from "../../lib/api";
import { submitOrQueue } from "../../lib/queue";
import { Field, Button, Label, ErrorText, Card } from "../../lib/ui";
import { useLocationPing } from "../../lib/use-location-ping";
import { colors } from "../../lib/theme";

export default function WeighInScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [materialTypeId, setMaterialTypeId] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(0);

  // Share live location with the admin while collecting on this trip
  useLocationPing(tripId, true);

  useEffect(() => {
    loadBootstrap().then(setBoot);
  }, []);

  const vendors = (boot?.vendors ?? []).filter(
    (v) =>
      vendorQuery.length < 2 ||
      v.name.toLowerCase().includes(vendorQuery.toLowerCase()) ||
      v.phone.includes(vendorQuery),
  );
  const selectedVendor = boot?.vendors.find((v) => v.id === vendorId);

  async function submit() {
    const kg = Number(weight);
    if (!vendorId) return setError("Pick the vendor you're weighing with.");
    if (!materialTypeId) return setError("Pick the material type.");
    if (!kg || kg <= 0) return setError("Enter the scale reading in kg.");

    setBusy(true);
    setError(null);

    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getLastKnownPositionAsync();
        lat = pos?.coords.latitude ?? null;
        lng = pos?.coords.longitude ?? null;
      }
    } catch {
      // GPS stamp is best-effort; the weigh-in must never be blocked by it
    }

    const payload = {
      clientUuid: Crypto.randomUUID(),
      tripId,
      vendorId,
      materialTypeId,
      weightKg: kg,
      lat,
      lng,
    };
    try {
      const outcome = await submitOrQueue("weighin", payload.clientUuid, payload);
      setRecorded((n) => n + 1);
      setWeight("");
      setVendorId(null);
      setVendorQuery("");
      setMaterialTypeId(null);
      Alert.alert(
        outcome === "sent" ? "Weigh-in recorded" : "Saved offline",
        outcome === "sent"
          ? `${kg} kg recorded. The admin sees it immediately.`
          : `${kg} kg saved — will sync when you're back online.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record weigh-in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {recorded > 0 && (
        <Card style={{ marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colors.accent }}>
          <Text style={{ color: colors.accentDark, fontWeight: "600" }}>
            {recorded} weigh-in{recorded > 1 ? "s" : ""} recorded this session
          </Text>
        </Card>
      )}

      <Card>
        <Label>Vendor *</Label>
        {selectedVendor ? (
          <Pressable onPress={() => setVendorId(null)} style={styles.selected}>
            <Text style={{ fontWeight: "600", color: colors.accentDark }}>
              {selectedVendor.name} · {selectedVendor.phone}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Tap to change</Text>
          </Pressable>
        ) : (
          <>
            <Field
              value={vendorQuery}
              onChangeText={setVendorQuery}
              placeholder="Search name or phone…"
            />
            <View style={{ maxHeight: 200 }}>
              {vendors.slice(0, 6).map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => setVendorId(v.id)}
                  style={styles.vendorRow}
                  accessibilityRole="button"
                >
                  <Text style={{ color: colors.text }}>{v.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{v.phone}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Label>Material *</Label>
        <View style={styles.chipRow}>
          {(boot?.materials ?? []).map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setMaterialTypeId(m.id)}
              style={[styles.chip, materialTypeId === m.id && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, materialTypeId === m.id && styles.chipTextActive]}>
                {m.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Label>Scale reading (kg) *</Label>
        <Field
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder="0.0"
          style={{ fontSize: 24, fontWeight: "700", textAlign: "center" }}
        />

        <View style={{ height: 16 }} />
        <ErrorText>{error}</ErrorText>
        {error && <View style={{ height: 8 }} />}
        <Button
          title={busy ? "Recording…" : "Record weigh-in"}
          onPress={submit}
          disabled={busy}
        />
        <View style={{ height: 8 }} />
        <Button title="Done — back to trips" variant="secondary" onPress={() => router.back()} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  selected: {
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  vendorRow: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.accentDark, fontWeight: "600" },
});
