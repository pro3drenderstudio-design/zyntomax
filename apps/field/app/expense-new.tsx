import { useEffect, useState } from "react";
import { View, Image, Pressable, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { getExpenses, createExpense, uploadPhoto, type ExpensesData } from "../lib/api";
import { Card, Txt, Row, Button, Field, ErrorText, Loading } from "../lib/ui";
import { colors, space, radius } from "../lib/theme";

async function shrink(uri: string): Promise<string> {
  const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
  return r.uri;
}

export default function ExpenseNewScreen() {
  const router = useRouter();
  const [opts, setOpts] = useState<ExpensesData | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getExpenses().then((d) => { setOpts(d); if (d.sites.length === 1) setSiteId(d.sites[0].id); }).catch(() => setOpts(null));
  }, []);
  if (opts === null) return <Loading />;

  async function takePhoto() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError("Camera permission is needed to photograph the receipt.");
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) setReceipt(await shrink(res.assets[0].uri));
  }

  async function submit() {
    const amt = Number(amount);
    if (!siteId) return setError("Pick the site.");
    if (!categoryId) return setError("Pick a category.");
    if (!amt || amt <= 0) return setError("Enter a valid amount.");

    setBusy(true); setError(null);
    try {
      let receiptUrl: string | undefined;
      if (receipt) receiptUrl = await uploadPhoto(receipt);
      await createExpense({ siteId, categoryId, amount: amt, description: description.trim() || undefined, receiptUrl });
      Alert.alert("Expense recorded", "It now shows in expenses and the P&L.");
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record expense");
    } finally { setBusy(false); }
  }

  const chip = (active: boolean) => ({
    borderWidth: 1, borderColor: active ? colors.accent : colors.border,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9,
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
      {opts.sites.length > 1 && (
        <Card>
          <Txt variant="smallStrong" style={{ marginBottom: 8 }}>Site</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {opts.sites.map((s) => (
              <Pressable key={s.id} onPress={() => setSiteId(s.id)} style={chip(siteId === s.id)}>
                <Txt variant="small" color={siteId === s.id ? colors.accentDark : colors.text}>{s.name}</Txt>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 8 }}>Category</Txt>
        {opts.categories.length === 0 ? (
          <Txt variant="small" color={colors.muted}>No categories yet — add one on the web app first.</Txt>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {opts.categories.map((c) => (
              <Pressable key={c.id} onPress={() => setCategoryId(c.id)} style={chip(categoryId === c.id)}>
                <Txt variant="small" color={categoryId === c.id ? colors.accentDark : colors.text}>{c.name}</Txt>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 6 }}>Amount (₦)</Txt>
        <Field value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" style={{ fontSize: 26, fontWeight: "700", textAlign: "center" }} />
      </Card>

      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 6 }}>Note (optional)</Txt>
        <Field value={description} onChangeText={setDescription} placeholder="What was this for?" />
      </Card>

      {receipt ? (
        <View>
          <Image source={{ uri: receipt }} style={{ width: "100%", height: 180, borderRadius: radius.lg, backgroundColor: colors.bgAlt }} />
          <Button title="Retake receipt" variant="secondary" small icon={<Ionicons name="camera-outline" size={16} color={colors.text} />} onPress={takePhoto} />
        </View>
      ) : (
        <Card onPress={takePhoto}>
          <Row gap={space.sm} justify="center">
            <Ionicons name="camera-outline" size={20} color={colors.accent} />
            <Txt variant="body" color={colors.accent}>Photograph receipt (optional)</Txt>
          </Row>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Save expense" loading={busy} onPress={submit} icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
