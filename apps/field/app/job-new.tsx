import { useEffect, useState } from "react";
import { View, Image, Pressable, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { getProductionSetup, scaleInJob, uploadPhoto, type ProductionSetup } from "../lib/api";
import { Card, Txt, Row, Button, Field, ErrorText, Loading } from "../lib/ui";
import { colors, space, radius } from "../lib/theme";
import { kg } from "../lib/format";

async function shrink(uri: string): Promise<string> {
  const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
  return r.uri;
}

export default function ScaleInScreen() {
  const router = useRouter();
  const [setup, setSetup] = useState<ProductionSetup | null>(null);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getProductionSetup().then(setSetup).catch(() => setSetup(null)); }, []);
  if (setup === null) return <Loading />;

  const stageName = (id: string) => setup.stages.find((s) => s.id === id)?.name ?? "Stage";
  const input = setup.inputs.find((m) => m.materialId === materialId) ?? null;
  const stageOptions = input ? input.stageIds : [];
  const previewOutputs = materialId && stageId ? (setup.outputsByKey[`${stageId}:${materialId}`] ?? []) : [];

  async function takePhoto() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError("Camera permission is needed to photograph the scale reading.");
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhoto(await shrink(res.assets[0].uri));
  }

  async function submit() {
    if (!setup) return;
    const w = Number(weight);
    if (!materialId) return setError("Pick the input material.");
    if (!stageId) return setError("Pick the stage.");
    if (!w || w <= 0) return setError("Enter the scale-in reading in kg.");
    if (input && w > input.availableKg + 0.0001) return setError(`Only ${kg(input.availableKg)} available in stock.`);

    setBusy(true); setError(null);
    try {
      let scaleInPhotoUrl: string | undefined;
      if (photo) scaleInPhotoUrl = await uploadPhoto(photo);
      const { id } = await scaleInJob({ siteId: setup.siteId, stageId, materialTypeId: materialId, weightInKg: w, scaleInPhotoUrl });
      Alert.alert("Job started", `${kg(w)} scaled in at ${stageName(stageId)}.`);
      router.replace(`/job/${id}` as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start job");
    } finally { setBusy(false); }
  }

  if (setup.inputs.length === 0) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg }}>
        <Card><Txt variant="bodyStrong">No material available to process</Txt><Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>Scale in raw intake or complete an upstream stage first.</Txt></Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 8 }}>Input material</Txt>
        <View style={{ gap: space.sm }}>
          {setup.inputs.map((m) => {
            const active = materialId === m.materialId;
            return (
              <Pressable key={m.materialId} onPress={() => { setMaterialId(m.materialId); setStageId(null); }} style={{ borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface, borderRadius: radius.md, padding: space.md }}>
                <Row justify="space-between">
                  <Txt variant="body" color={active ? colors.accentDark : colors.text} style={active ? { fontWeight: "700" } : undefined}>{m.name}</Txt>
                  <Txt variant="small" color={colors.muted}>{kg(m.availableKg)}</Txt>
                </Row>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {input && (
        <Card>
          <Txt variant="smallStrong" style={{ marginBottom: 8 }}>Stage</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {stageOptions.map((sid) => {
              const active = stageId === sid;
              return (
                <Pressable key={sid} onPress={() => setStageId(sid)} style={{ borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <Txt variant="small" color={active ? colors.accentDark : colors.text} style={active ? { fontWeight: "700" } : undefined}>{stageName(sid)}</Txt>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}

      {previewOutputs.length > 0 && (
        <Card style={{ backgroundColor: colors.surfaceAlt }}>
          <Txt variant="tiny" color={colors.muted} style={{ marginBottom: 4 }}>WILL PRODUCE</Txt>
          <Txt variant="small">{previewOutputs.map((o) => o.name).join(" · ")}</Txt>
        </Card>
      )}

      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 6 }}>Scale-in reading (kg)</Txt>
        <Field value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0.0" style={{ fontSize: 26, fontWeight: "700", textAlign: "center" }} />
      </Card>

      {photo ? (
        <View>
          <Image source={{ uri: photo }} style={{ width: "100%", height: 200, borderRadius: radius.lg, backgroundColor: colors.bgAlt }} />
          <Button title="Retake photo" variant="secondary" small icon={<Ionicons name="camera-outline" size={16} color={colors.text} />} onPress={takePhoto} />
        </View>
      ) : (
        <Card onPress={takePhoto}>
          <Row gap={space.sm} justify="center">
            <Ionicons name="camera-outline" size={20} color={colors.accent} />
            <Txt variant="body" color={colors.accent}>Photograph the scale (optional)</Txt>
          </Row>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Start job" loading={busy} onPress={submit} icon={<Ionicons name="play" size={18} color="#fff" />} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
