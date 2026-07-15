import { useEffect, useState } from "react";
import {
  ScrollView, Text, View, StyleSheet, Alert, Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import { loadBootstrap, type Bootstrap } from "../lib/api";
import { submitOrQueue } from "../lib/queue";
import { Field, Button, Label, ErrorText, Card } from "../lib/ui";
import { colors } from "../lib/theme";

export default function VendorNewScreen() {
  const router = useRouter();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [localityId, setLocalityId] = useState<string | null>(null);
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBootstrap().then(setBoot);
  }, []);

  async function pinLocation() {
    setPinBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission is needed to pin the vendor's house.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setError(null);
    } catch {
      setError("Could not get location. Try again outdoors.");
    } finally {
      setPinBusy(false);
    }
  }

  async function submit() {
    if (name.trim().length < 2) return setError("Enter the vendor's full name.");
    if (!/^0\d{10}$/.test(phone.trim())) return setError("Enter an 11-digit phone number.");
    if (!boot) return setError("Master data not loaded yet.");

    setBusy(true);
    setError(null);
    const bank = boot.banks.find((b) => b.code === bankCode);
    const payload = {
      clientUuid: Crypto.randomUUID(),
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim() || undefined,
      siteId: boot.sites[0].id,
      localityId,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      bankCode,
      bankName: bank?.name ?? null,
      bankAccountNo: bankAccountNo.trim() || null,
    };
    try {
      const outcome = await submitOrQueue("vendor", payload.clientUuid, payload);
      Alert.alert(
        outcome === "sent" ? "Vendor registered" : "Saved offline",
        outcome === "sent"
          ? `${name} is now registered.`
          : `${name} will sync when you're back online.`,
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Label>Full name *</Label>
        <Field value={name} onChangeText={setName} placeholder="Mama Risi" />

        <Label>Phone number *</Label>
        <Field value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="08012345678" />

        <Label>House address</Label>
        <Field value={address} onChangeText={setAddress} />

        <Label>Locality</Label>
        <View style={styles.chipRow}>
          {(boot?.localities ?? []).map((l) => (
            <Pressable
              key={l.id}
              onPress={() => setLocalityId(l.id === localityId ? null : l.id)}
              style={[styles.chip, localityId === l.id && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, localityId === l.id && styles.chipTextActive]}>
                {l.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 12 }} />
        <Button
          title={
            pinBusy
              ? "Getting location…"
              : coords
                ? `Pinned ✓ ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                : "Pin current location"
          }
          variant={coords ? "secondary" : "primary"}
          onPress={pinLocation}
          disabled={pinBusy}
        />
        {coords && (
          <Text style={styles.pinHint}>
            Stand at the vendor&apos;s gate when pinning — this drives the admin map.
          </Text>
        )}

        <Label>Bank (for automatic payment)</Label>
        <View style={styles.chipRow}>
          {(boot?.banks ?? []).slice(0, 12).map((b) => (
            <Pressable
              key={b.code}
              onPress={() => setBankCode(b.code === bankCode ? null : b.code)}
              style={[styles.chip, bankCode === b.code && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, bankCode === b.code && styles.chipTextActive]}>
                {b.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Label>Account number</Label>
        <Field
          value={bankAccountNo}
          onChangeText={setBankAccountNo}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="10 digits"
        />

        <View style={{ height: 16 }} />
        <ErrorText>{error}</ErrorText>
        {error && <View style={{ height: 8 }} />}
        <Button title={busy ? "Registering…" : "Register vendor"} onPress={submit} disabled={busy} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: colors.accentDark, fontWeight: "600" },
  pinHint: { fontSize: 12, color: colors.accentDark, marginTop: 6 },
});
