import { useCallback, useState } from "react";
import { View, Pressable, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { getHome, updateProfile, uploadPhoto } from "../../lib/api";
import { Screen, Card, Txt, Button, Field, ErrorText, Avatar, Loading } from "../../lib/ui";
import { colors, space } from "../../lib/theme";

export default function EditProfileScreen() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [address, setAddress] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const h = await getHome();
      setName(h.vendor.name); setNickname(h.vendor.nickname ?? "");
      setAddress(h.vendor.address ?? ""); setPhoto(h.vendor.photoUrl ?? null);
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!loaded) return <Loading />;

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1], mediaTypes: ["images"] });
    if (!res.canceled && res.assets[0]) {
      const m = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 600 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
      setPhoto(m.uri);
    }
  }

  async function save() {
    if (name.trim().length < 2) return setError("Enter your name.");
    setBusy(true); setError(null);
    try {
      let photoUrl: string | undefined;
      if (photo && photo.startsWith("file")) photoUrl = await uploadPhoto(photo);
      await updateProfile({ name: name.trim(), nickname: nickname.trim(), address: address.trim(), photoUrl });
      Alert.alert("Saved", "Your profile has been updated.");
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally { setBusy(false); }
  }

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: space.sm }}>
        <Avatar name={name || "You"} uri={photo} size={96} />
        <Pressable onPress={pickPhoto}><Txt variant="smallStrong" color={colors.accent}>Change photo</Txt></Pressable>
      </View>
      <Card>
        <Field label="Full name" value={name} onChangeText={setName} />
        <Field label="Nickname (optional)" value={nickname} onChangeText={setNickname} />
        <Field label="Address (optional)" value={address} onChangeText={setAddress} placeholder="Where should we find you?" multiline />
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button title="Save changes" loading={busy} onPress={save} />
    </Screen>
  );
}
