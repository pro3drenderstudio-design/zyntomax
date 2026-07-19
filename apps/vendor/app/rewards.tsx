import { useCallback, useState } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { getHome, type VendorHome } from "../lib/api";
import { Card } from "../lib/ui";
import { colors } from "../lib/theme";

const kg = (n: number) => n.toLocaleString("en-NG", { maximumFractionDigits: 1 }) + " kg";

export default function RewardsScreen() {
  const [home, setHome] = useState<VendorHome | null>(null);
  useFocusEffect(useCallback(() => { getHome().then(setHome).catch(() => {}); }, []));

  const lifetime = home?.lifetimeKg ?? 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.big}>{kg(lifetime)}</Text>
        <Text style={styles.meta}>recycled with Zyntomax so far</Text>
      </Card>
      {home?.rewards.tiers.map((t) => {
        const progress = Math.min(1, lifetime / t.thresholdKg);
        return (
          <Card key={t.name} style={{ marginBottom: 10 }}>
            <View style={styles.between}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{t.name}</Text>
              <Text style={{ color: t.earned ? colors.accent : colors.muted, fontWeight: "600" }}>{t.earned ? "Earned ✓" : kg(t.thresholdKg)}</Text>
            </View>
            <Text style={styles.meta}>{t.reward}</Text>
            {!t.earned && (
              <View style={styles.barBg}><View style={[styles.barFill, { width: `${progress * 100}%` }]} /></View>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 30, fontWeight: "800", color: colors.accent },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  between: { flexDirection: "row", justifyContent: "space-between" },
  barBg: { height: 8, backgroundColor: colors.limeSoft, borderRadius: 5, marginTop: 8, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: colors.accent, borderRadius: 5 },
});
