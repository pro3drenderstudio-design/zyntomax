import { useCallback, useState } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { getHome, type VendorHome } from "../lib/api";
import { Card } from "../lib/ui";
import { colors } from "../lib/theme";

const naira = (n: number) => "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });

const tone = (s: string) => (s === "SUCCESS" ? colors.accent : s === "FAILED" ? colors.destructive : colors.warning);

export default function PaymentsScreen() {
  const [home, setHome] = useState<VendorHome | null>(null);
  useFocusEffect(useCallback(() => { getHome().then(setHome).catch(() => {}); }, []));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {home?.payments.length === 0 && (
        <Card><Text style={{ color: colors.muted, textAlign: "center", paddingVertical: 12 }}>No payments yet.</Text></Card>
      )}
      {home?.payments.map((p) => (
        <Card key={p.id} style={{ marginBottom: 8 }}>
          <View style={styles.between}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{naira(p.amount)}</Text>
            <Text style={{ color: tone(p.status), fontWeight: "600" }}>{p.status}</Text>
          </View>
          <Text style={styles.meta}>{new Date(p.date).toLocaleDateString("en-NG")}{p.reference ? ` · ${p.reference}` : ""}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between" },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
