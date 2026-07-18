import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, StyleSheet, Linking } from "react-native";
import { loadBootstrap, type Bootstrap } from "../lib/api";
import { navigateTo } from "../lib/navigate";
import { Card, Button, Field } from "../lib/ui";
import { colors } from "../lib/theme";

type V = Bootstrap["vendors"][number] & { lat?: number | null; lng?: number | null };

export default function VendorsScreen() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { loadBootstrap().then(setBoot); }, []);

  const vendors = useMemo(() => {
    const list = (boot?.vendors ?? []) as V[];
    if (q.length < 2) return list.slice(0, 40);
    const s = q.toLowerCase();
    return list.filter((v) => v.name.toLowerCase().includes(s) || v.phone.includes(q)).slice(0, 40);
  }, [boot, q]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Field value={q} onChangeText={setQ} placeholder="Search vendors by name or phone…" style={{ marginBottom: 12 }} />
      {vendors.map((v) => (
        <Card key={v.id} style={{ marginBottom: 8 }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{v.name}</Text>
              <Text style={styles.meta}>{v.phone}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Call" variant="secondary" onPress={() => Linking.openURL(`tel:${v.phone}`)} />
              {v.lat != null && v.lng != null && (
                <Button title="Navigate" onPress={() => navigateTo(v.lat!, v.lng!, v.name)} />
              )}
            </View>
          </View>
        </Card>
      ))}
      {vendors.length === 0 && (
        <Card><Text style={{ color: colors.muted, textAlign: "center", paddingVertical: 12 }}>No vendors match.</Text></Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 1 },
});
