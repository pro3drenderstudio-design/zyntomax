import { useCallback, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getStoredUser, refreshSession } from "../../lib/api";
import { visibleSections, type ModuleItem } from "../../lib/modules";
import { Screen, Txt, Row, Loading, Badge } from "../../lib/ui";
import { colors, space, radius } from "../../lib/theme";

export default function ManageScreen() {
  const router = useRouter();
  const [roles, setRoles] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    // Show cached roles instantly, then reconcile with the server so role
    // changes / suspensions take effect without a manual re-login.
    const cached = await getStoredUser();
    if (!cached) { router.replace("/login"); return; }
    setRoles(cached.roles);
    const fresh = await refreshSession();
    if (!fresh) { router.replace("/login"); return; }
    setRoles(fresh.roles);
  }, [router]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!roles) return <Loading />;

  const sections = visibleSections(roles);

  return (
    <Screen>
      <Txt variant="small" color={colors.muted}>Everything you manage on the web, on the go — limited to your role.</Txt>
      {sections.map((s) => (
        <View key={s.section} style={{ gap: space.sm }}>
          <Txt variant="tiny" color={colors.muted} style={{ textTransform: "uppercase" }}>{s.section}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            {s.items.map((item) => <Tile key={item.key} item={item} onPress={() => router.push((item.built ? item.href : "/soon") as never)} />)}
          </View>
        </View>
      ))}
    </Screen>
  );
}

function Tile({ item, onPress }: { item: ModuleItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: "47%", flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: 8 }, pressed && { opacity: 0.7 }]}>
      <Row justify="space-between">
        <Ionicons name={item.icon} size={24} color={item.built ? colors.accent : colors.mutedLight} />
        {!item.built && <Badge label="Soon" />}
      </Row>
      <Txt variant="bodyStrong" color={item.built ? colors.text : colors.muted}>{item.label}</Txt>
    </Pressable>
  );
}
