import { useCallback, useState } from "react";
import { View, Image, Pressable, Alert, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { getJob, scaleOutJob, uploadPhoto, type JobDetail } from "../../lib/api";
import { Card, Txt, Row, Button, Field, ErrorText, Badge, Loading, Divider } from "../../lib/ui";
import { colors, space, radius } from "../../lib/theme";
import { kg } from "../../lib/format";

async function shrink(uri: string): Promise<string> {
  const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
  return r.uri;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [waste, setWaste] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setJob(await getJob(id)); } catch (e) { setError(e instanceof Error ? e.message : "Could not load job"); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (job === null) return <Loading />;

  const done = job.status === "COMPLETED" || job.status === "FLAGGED";
  const outSum = job.outputs.reduce((s, o) => s + (Number(weights[o.materialId]) || 0), 0);
  const wasteN = Number(waste) || 0;
  const total = outSum + wasteN;
  const diff = job.weightInKg > 0 ? ((total - job.weightInKg) / job.weightInKg) * 100 : 0;
  const withinTol = Math.abs(diff) <= job.tolerancePct;

  async function takePhoto() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError("Camera permission is needed to photograph the scale reading.");
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhoto(await shrink(res.assets[0].uri));
  }

  async function submit() {
    if (!job) return;
    const outputs = job.outputs
      .map((o) => ({ outputMaterialTypeId: o.materialId, weightKg: Number(weights[o.materialId]) || 0 }))
      .filter((o) => o.weightKg > 0);
    if (outputs.length === 0) return setError("Enter at least one output weight.");

    setBusy(true); setError(null);
    try {
      let scaleOutPhotoUrl: string | undefined;
      if (photo) scaleOutPhotoUrl = await uploadPhoto(photo);
      const { status } = await scaleOutJob(job.id, { outputs, wasteKg: wasteN, scaleOutPhotoUrl });
      if (status === "FLAGGED") {
        Alert.alert("Job flagged", "Outputs are beyond tolerance. A supervisor will review before inventory moves.");
      } else {
        Alert.alert("Job completed", "Outputs recorded and inventory updated.");
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete job");
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <Row justify="space-between">
          <Txt variant="h3">{job.stage}</Txt>
          <Badge label={job.status} status={job.status} />
        </Row>
        <Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>{job.inputMaterial} · {kg(job.weightInKg)} in</Txt>
        {job.assignees.length > 0 ? <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: 4 }}>{job.assignees.join(", ")}</Txt> : null}
        {job.flagReason ? <Txt variant="small" color={colors.destructive} style={{ marginTop: 6 }}>{job.flagReason}</Txt> : null}
      </Card>

      {done ? (
        <Card>
          <Txt variant="smallStrong" style={{ marginBottom: 8 }}>Recorded outputs</Txt>
          {job.recorded.map((o, i) => (
            <View key={o.materialId}>
              {i > 0 && <Divider />}
              <Row justify="space-between" style={{ paddingVertical: 8 }}>
                <Txt variant="body">{o.name}</Txt>
                <Txt variant="bodyStrong">{kg(o.weightKg)}</Txt>
              </Row>
            </View>
          ))}
          {job.wasteKg != null && <Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>Waste: {kg(job.wasteKg)}</Txt>}
        </Card>
      ) : (
        <>
          <Card>
            <Txt variant="smallStrong" style={{ marginBottom: 4 }}>Scale out — weigh each output</Txt>
            {job.outputs.length === 0 ? (
              <Txt variant="small" color={colors.muted}>No recipe outputs configured for this stage/material. Ask an admin to set the recipe.</Txt>
            ) : job.outputs.map((o) => (
              <View key={o.materialId} style={{ marginTop: space.sm }}>
                <Txt variant="small" color={colors.muted} style={{ marginBottom: 4 }}>{o.name}</Txt>
                <Field value={weights[o.materialId] ?? ""} onChangeText={(v) => setWeights((w) => ({ ...w, [o.materialId]: v }))} keyboardType="decimal-pad" placeholder="0.0 kg" />
              </View>
            ))}
            <View style={{ marginTop: space.md }}>
              <Txt variant="small" color={colors.muted} style={{ marginBottom: 4 }}>Waste (kg)</Txt>
              <Field value={waste} onChangeText={setWaste} keyboardType="decimal-pad" placeholder="0.0 kg" />
            </View>
          </Card>

          <Card style={{ backgroundColor: withinTol ? colors.successSoft : colors.warningSoft }}>
            <Row justify="space-between">
              <Txt variant="small" color={colors.muted}>Out + waste</Txt>
              <Txt variant="bodyStrong">{kg(total)} / {kg(job.weightInKg)}</Txt>
            </Row>
            <Row justify="space-between" style={{ marginTop: 2 }}>
              <Txt variant="small" color={colors.muted}>Discrepancy (tol ±{job.tolerancePct}%)</Txt>
              <Txt variant="smallStrong" color={withinTol ? colors.success : colors.warning}>{diff >= 0 ? "+" : ""}{diff.toFixed(1)}%</Txt>
            </Row>
            {!withinTol && <Txt variant="tiny" color={colors.warning} style={{ marginTop: 4 }}>Beyond tolerance — this job will be flagged for supervisor review.</Txt>}
          </Card>

          {photo ? (
            <View>
              <Image source={{ uri: photo }} style={{ width: "100%", height: 180, borderRadius: radius.lg, backgroundColor: colors.bgAlt }} />
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
          <Button title="Complete job" loading={busy} onPress={submit} icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />} />
        </>
      )}

      <Button title="Back" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
