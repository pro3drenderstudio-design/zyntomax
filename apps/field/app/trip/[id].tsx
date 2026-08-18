import { useEffect, useState } from "react";
import { View, Image, Pressable, Alert, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { loadBootstrap, type Bootstrap } from "../../lib/api";
import { submitOrQueue } from "../../lib/queue";
import { SignaturePad } from "../../lib/signature";
import { Card, Txt, Row, Button, Field, ErrorText, Badge } from "../../lib/ui";
import { useLocationPing } from "../../lib/use-location-ping";
import { colors, space, radius } from "../../lib/theme";

async function shrink(uri: string): Promise<string> {
  const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
  return r.uri;
}

export default function WeighInScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [materialTypeId, setMaterialTypeId] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(0);

  useLocationPing(tripId, true);
  useEffect(() => { loadBootstrap().then(setBoot); }, []);

  const vendors = (boot?.vendors ?? []).filter(
    (v) => vendorQuery.length < 2 || v.name.toLowerCase().includes(vendorQuery.toLowerCase()) || v.phone.includes(vendorQuery),
  );
  const selectedVendor = boot?.vendors.find((v) => v.id === vendorId);

  async function takePhoto() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError("Camera permission is needed to photograph the weigh-in.");
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhoto(await shrink(res.assets[0].uri));
  }

  function reset() {
    setWeight(""); setVendorId(null); setVendorQuery(""); setMaterialTypeId(null); setPhoto(null); setSignature(null);
  }

  async function submit() {
    const kg = Number(weight);
    if (!vendorId) return setError("Pick the vendor you're weighing with.");
    if (!materialTypeId) return setError("Pick the material type.");
    if (!kg || kg <= 0) return setError("Enter the scale reading in kg.");
    if (!photo) return setError("Take a photo of the weigh-in.");

    setBusy(true); setError(null);
    let lat: number | null = null, lng: number | null = null;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getLastKnownPositionAsync();
        lat = pos?.coords.latitude ?? null; lng = pos?.coords.longitude ?? null;
      }
    } catch { /* GPS best-effort */ }

    const clientUuid = Crypto.randomUUID();
    const payload = { clientUuid, tripId, vendorId, materialTypeId, weightKg: kg, lat, lng };
    try {
      const outcome = await submitOrQueue("weighin", clientUuid, payload, {
        photoUri: photo, signatureUri: signature ?? undefined,
      });
      setRecorded((n) => n + 1);
      reset();
      Alert.alert(
        outcome === "sent" ? "Weigh-in recorded" : "Saved offline",
        outcome === "sent" ? `${kg} kg recorded — the admin sees it immediately.` : `${kg} kg saved — photo and record will sync when you're back online.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record weigh-in");
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
      {recorded > 0 && (
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
          <Row gap={space.sm}><Ionicons name="checkmark-circle" size={18} color={colors.accentDark} /><Txt variant="bodyStrong" color={colors.accentDark}>{recorded} weigh-in{recorded > 1 ? "s" : ""} this session</Txt></Row>
        </Card>
      )}

      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 6 }}>Vendor</Txt>
        {selectedVendor ? (
          <Pressable onPress={() => setVendorId(null)} style={{ backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: colors.accent }}>
            <Txt variant="bodyStrong" color={colors.accentDark}>{selectedVendor.name}</Txt>
            <Txt variant="small" color={colors.muted}>{selectedVendor.phone} · tap to change</Txt>
          </Pressable>
        ) : (
          <>
            <Field value={vendorQuery} onChangeText={setVendorQuery} placeholder="Search name or phone…" />
            <View>
              {vendors.slice(0, 6).map((v, i) => (
                <Pressable key={v.id} onPress={() => setVendorId(v.id)} style={{ paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <Txt variant="body">{v.name}</Txt>
                  <Txt variant="small" color={colors.muted}>{v.phone}</Txt>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </Card>

      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 8 }}>Material</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {(boot?.materials ?? []).map((m) => {
            const active = materialTypeId === m.id;
            return (
              <Pressable key={m.id} onPress={() => setMaterialTypeId(m.id)} style={{ borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 }}>
                <Txt variant="small" color={active ? colors.accentDark : colors.text} style={active ? { fontWeight: "700" } : undefined}>{m.name}</Txt>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 6 }}>Scale reading (kg)</Txt>
        <Field value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0.0" style={{ fontSize: 26, fontWeight: "700", textAlign: "center" }} />
      </Card>

      {/* Photo */}
      {photo ? (
        <View>
          <Image source={{ uri: photo }} style={{ width: "100%", height: 200, borderRadius: radius.lg, backgroundColor: colors.bgAlt }} />
          <Row gap={space.sm} style={{ marginTop: space.sm }}>
            <View style={{ flex: 1 }}><Button title="Retake photo" variant="secondary" small icon={<Ionicons name="camera-outline" size={16} color={colors.text} />} onPress={takePhoto} /></View>
          </Row>
        </View>
      ) : (
        <Card>
          <Pressable onPress={takePhoto} style={{ alignItems: "center", paddingVertical: space.lg, gap: 6 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name="camera" size={28} color={colors.accent} /></View>
            <Txt variant="bodyStrong">Photograph the weigh-in</Txt>
            <Txt variant="small" color={colors.muted}>Required</Txt>
          </Pressable>
        </Card>
      )}

      {/* Signature (optional) */}
      <Card onPress={() => setSigning(true)}>
        <Row justify="space-between">
          <Row gap={space.sm}>
            <Ionicons name={signature ? "checkmark-circle" : "create-outline"} size={20} color={signature ? colors.success : colors.muted} />
            <Txt variant="body">{signature ? "Vendor signed" : "Add vendor signature (optional)"}</Txt>
          </Row>
          {signature ? <Badge label="Signed" status="ACTIVE" /> : <Ionicons name="chevron-forward" size={18} color={colors.mutedLight} />}
        </Row>
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title="Record weigh-in" loading={busy} onPress={submit} icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />} />
      <Button title="Done — back to trips" variant="secondary" onPress={() => router.back()} />

      <SignaturePad visible={signing} onCancel={() => setSigning(false)} onDone={(uri) => { setSignature(uri); setSigning(false); }} />
    </ScrollView>
  );
}
