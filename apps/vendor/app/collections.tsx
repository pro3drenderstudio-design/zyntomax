import { useCallback, useState } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { getHome, type VendorHome } from "../lib/api";
import { Card } from "../lib/ui";
import { colors } from "../lib/theme";

const naira = (n: number) => "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
const kg = (n: number) => n.toLocaleString("en-NG", { maximumFractionDigits: 1 }) + " kg";

export default function CollectionsScreen() {
  const [home, setHome] = useState<VendorHome | null>(null);
  useFocusEffect(useCallback(() => { getHome().then(setHome).catch(() => {}); }, []));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {home?.collections.length === 0 && (
        <Card><Text style={{ color: colors.muted, textAlign: "center", paddingVertical: 12 }}>No collections yet. Request a pickup to get started.</Text></Card>
      )}
      {home?.collections.map((c) => (
        <Card key={c.id} style={{ marginBottom: 8 }}>
          <View style={styles.between}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>{c.material}</Text>
            <Text style={{ color: colors.accent, fontWeight: "700" }}>{naira(c.amount)}</Text>
          </View>
          <Text style={styles.meta}>{kg(c.weightKg)} · {new Date(c.date).toLocaleDateString("en-NG")}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between" },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
