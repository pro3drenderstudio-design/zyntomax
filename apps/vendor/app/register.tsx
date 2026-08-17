import { useState } from "react";
import { View, Image, Pressable, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import { registerVendor } from "../lib/api";
import { Card, Txt, Row, Button, Field, ErrorText } from "../lib/ui";
import { MiniMap } from "../lib/map";
import { colors, space, radius } from "../lib/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [ref, setRef] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function takePhoto() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError("Camera permission is needed for your photo.");
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1], cameraType: ImagePicker.CameraType.front });
    if (!res.canceled && res.assets[0]) {
      const m = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 700 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
      setPhoto(m.uri);
    }
  }

  async function pinLocation() {
    setLocating(true); setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { setError("Location permission is needed to pin where you are."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      setError("Could not get your location. Try again.");
    } finally { setLocating(false); }
  }

  async function submit() {
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (!/^0\d{10}$/.test(phone.trim())) return setError("Enter your 11-digit phone number.");
    if (!photo) return setError("Please add your photo.");
    setBusy(true); setError(null);
    try {
      await registerVendor({
        name: name.trim(), phone: phone.trim(), photoUri: photo, address: address.trim() || undefined,
        lat: coords?.lat, lng: coords?.lng, referredByCode: ref.trim() || undefined,
      });
      Alert.alert("Registration submitted", "Your account is awaiting approval. We'll notify you and you can sign in once it's approved.", [
        { text: "OK", onPress: () => router.replace("/login") },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
      <Txt variant="small" color={colors.muted}>Create your vendor account. After you submit, our team reviews and approves it — then you can sign in.</Txt>

      {/* Photo */}
      <View style={{ alignItems: "center", gap: space.sm }}>
        <Pressable onPress={takePhoto}>
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: colors.bgAlt }} />
          ) : (
            <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="camera" size={34} color={colors.accent} />
            </View>
          )}
        </Pressable>
        <Pressable onPress={takePhoto}><Txt variant="smallStrong" color={colors.accent}>{photo ? "Retake photo" : "Take your photo"}</Txt></Pressable>
      </View>

      <Card>
        <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
        <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={11} placeholder="08012345678" />
        <Field label="Address (optional)" value={address} onChangeText={setAddress} placeholder="Where should we find you?" multiline />
        <Field label="Referral code (optional)" value={ref} onChangeText={setRef} autoCapitalize="characters" placeholder="From a friend" />
      </Card>

      {/* Location */}
      <Card>
        <Row justify="space-between">
          <Txt variant="bodyStrong">Pin your location</Txt>
          <Button title={coords ? "Update" : "Use my location"} small variant="secondary" loading={locating} onPress={pinLocation} />
        </Row>
        {coords ? (
          <View style={{ marginTop: space.sm }}>
            <MiniMap points={[{ lat: coords.lat, lng: coords.lng, label: "You", color: colors.accent }]} height={160} />
            <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: 4 }}>Helps our collectors find you faster.</Txt>
          </View>
        ) : (
          <Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>Optional, but recommended so we can locate you.</Txt>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title="Submit registration" loading={busy} onPress={submit} icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />} />
      <Pressable onPress={() => router.replace("/login")} style={{ alignItems: "center" }}>
        <Txt variant="small" color={colors.muted}>Already have an account? <Txt variant="smallStrong" color={colors.accent}>Sign in</Txt></Txt>
      </Pressable>
    </ScrollView>
  );
}
