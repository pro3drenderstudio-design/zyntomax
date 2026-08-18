import { useEffect, useMemo, useState } from "react";
import { View, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { loadBootstrap, type Bootstrap } from "../lib/api";
import { navigateTo } from "../lib/navigate";
import { Screen, Card, Txt, Row, Button, Field, Avatar, EmptyState, Loading } from "../lib/ui";
import { colors, space } from "../lib/theme";

export default function VendorsScreen() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { loadBootstrap().then(setBoot); }, []);

  const list = useMemo(() => {
    const all = boot?.vendors ?? [];
    if (q.trim().length < 2) return all.slice(0, 30);
    const s = q.trim().toLowerCase();
    return all.filter((v) => v.name.toLowerCase().includes(s) || v.phone.includes(s)).slice(0, 50);
  }, [boot, q]);

  if (!boot) return <Loading />;

  return (
    <Screen>
      <Field value={q} onChangeText={setQ} placeholder="Search vendors by name or phone…" />
      {list.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="people-outline" size={32} color={colors.mutedLight} />} title="No vendors found" /></Card>
      ) : (
        list.map((v) => (
          <Card key={v.id}>
            <Row gap={space.md}>
              <Avatar name={v.name} size={40} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{v.name}</Txt>
                <Txt variant="small" color={colors.muted}>{v.phone}</Txt>
              </View>
            </Row>
            <Row gap={space.sm} style={{ marginTop: space.md }}>
              <View style={{ flex: 1 }}><Button title="Call" small variant="secondary" icon={<Ionicons name="call-outline" size={16} color={colors.text} />} onPress={() => Linking.openURL(`tel:${v.phone}`)} /></View>
              {v.lat != null && v.lng != null && (
                <View style={{ flex: 1 }}><Button title="Navigate" small icon={<Ionicons name="navigate-outline" size={16} color="#fff" />} onPress={() => navigateTo(v.lat!, v.lng!, v.name)} /></View>
              )}
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
