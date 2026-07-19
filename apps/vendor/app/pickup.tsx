import { useCallback, useState } from "react";
import { ScrollView, Text, View, StyleSheet, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { requestPickup, getPickups, type VendorPickup } from "../lib/api";
import { Field, Button, Label, ErrorText, Card } from "../lib/ui";
import { colors } from "../lib/theme";

export default function PickupScreen() {
  const router = useRouter();
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickups, setPickups] = useState<VendorPickup[]>([]);

  const load = useCallback(async () => {
    try { setPickups(await getPickups()); } catch { /* ignore */ }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function submit() {
    const kg = Number(weight);
    if (!kg || kg <= 0) return setError("Enter the estimated weight.");
    setBusy(true); setError(null);
    try {
      await requestPickup(kg);
      Alert.alert("Pickup requested", "A collector will come to you. You'll get an SMS confirmation.");
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request pickup");
    } finally { setBusy(false); }
  }

  const hasOpen = pickups.some((p) => p.status === "PENDING" || p.status === "SCHEDULED");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {hasOpen ? (
        <Card><Text style={{ color: colors.text }}>You already have a pending pickup request. A collector will reach you soon.</Text></Card>
      ) : (
        <Card>
          <Label>Estimated weight of your recyclables (kg)</Label>
          <Field value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="e.g. 25" style={{ fontSize: 22, textAlign: "center" }} />
          <View style={{ height: 16 }} />
          <ErrorText>{error}</ErrorText>
          {error ? <View style={{ height: 8 }} /> : null}
          <Button title={busy ? "Requesting…" : "Request pickup"} onPress={submit} disabled={busy} />
          <Text style={styles.hint}>There is a minimum weight for pickups, set by Zyntomax. If yours is below it, keep collecting and request again.</Text>
        </Card>
      )}

      {pickups.length > 0 && (
        <>
          <Text style={styles.section}>Your requests</Text>
          {pickups.map((p) => (
            <Card key={p.id} style={{ marginBottom: 8 }}>
              <View style={styles.between}>
                <Text style={{ color: colors.text }}>~{p.estWeightKg} kg</Text>
                <Text style={{ color: colors.muted }}>{p.status.replace(/_/g, " ")}</Text>
              </View>
              <Text style={styles.meta}>{new Date(p.createdAt).toLocaleDateString("en-NG")}</Text>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginTop: 10 },
  section: { fontSize: 15, fontWeight: "600", color: colors.text, marginTop: 16, marginBottom: 8 },
  between: { flexDirection: "row", justifyContent: "space-between" },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
