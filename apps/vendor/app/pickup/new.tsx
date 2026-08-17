import { useState } from "react";
import { View, Image, Pressable, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import { uploadPhoto, requestPickup } from "../../lib/api";
import { Card, Txt, Row, Button, Field, ErrorText } from "../../lib/ui";
import { colors, space, radius } from "../../lib/theme";

async function shrink(uri: string): Promise<string> {
  const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], {
    compress: 0.6, format: ImageManipulator.SaveFormat.JPEG,
  });
  return r.uri;
}

export default function NewPickupScreen() {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function takePhoto() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError("Camera permission is needed to photograph your recyclables.");
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (!res.canceled && res.assets[0]) setPhoto(await shrink(res.assets[0].uri));
  }

  async function pickPhoto() {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!res.canceled && res.assets[0]) setPhoto(await shrink(res.assets[0].uri));
  }

  async function submit() {
    if (!photo) return setError("Please add a photo of your recyclables.");
    setBusy(true); setError(null);
    try {
      const photoUrl = await uploadPhoto(photo);

      // Best-effort location (non-blocking)
      let lat: number | undefined, lng: number | undefined;
      try {
        const p = await Location.requestForegroundPermissionsAsync();
        if (p.granted) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude; lng = loc.coords.longitude;
        }
      } catch { /* ignore location errors */ }

      const w = parseFloat(weight);
      await requestPickup({
        photoUrl,
        estWeightKg: Number.isFinite(w) && w > 0 ? w : undefined,
        note: note.trim() || undefined,
        lat, lng,
      });
      Alert.alert("Pickup requested", "We’ve received your request and will schedule a collection soon.");
      router.replace("/(tabs)/pickups");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit request");
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Txt variant="small" color={colors.muted}>
        Take a clear photo of your recyclables so we can confirm the load before dispatching a collector.
      </Txt>

      {photo ? (
        <View>
          <Image source={{ uri: photo }} style={{ width: "100%", height: 260, borderRadius: radius.lg, backgroundColor: colors.bgAlt }} />
          <Row gap={space.sm} style={{ marginTop: space.sm }}>
            <View style={{ flex: 1 }}><Button title="Retake" variant="secondary" small icon={<Ionicons name="camera-outline" size={16} color={colors.text} />} onPress={takePhoto} /></View>
            <View style={{ flex: 1 }}><Button title="Gallery" variant="secondary" small icon={<Ionicons name="image-outline" size={16} color={colors.text} />} onPress={pickPhoto} /></View>
          </Row>
        </View>
      ) : (
        <Card>
          <Pressable onPress={takePhoto} style={{ alignItems: "center", paddingVertical: space.xl, gap: space.sm }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="camera" size={30} color={colors.accent} />
            </View>
            <Txt variant="bodyStrong">Take a photo</Txt>
            <Txt variant="small" color={colors.muted}>Required</Txt>
          </Pressable>
          <Button title="Choose from gallery" variant="ghost" small onPress={pickPhoto} />
        </Card>
      )}

      <Card>
        <Field label="Estimated weight (kg) — optional" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="e.g. 25" />
        <Field label="Note — optional" value={note} onChangeText={setNote} placeholder="e.g. Mostly PET bottles, behind the blue gate" multiline />
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title="Submit pickup request" loading={busy} onPress={submit} icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />} />
    </ScrollView>
  );
}
