import { useCallback, useState } from "react";
import { View, Pressable, Alert, Switch, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getStoredUser, logout, type MobileUser } from "../../lib/api";
import { Screen, Card, Txt, Row, Avatar, Divider, Loading, SectionHeader } from "../../lib/ui";
import { colors, space } from "../../lib/theme";
import { useI18n, LANGUAGES } from "../../lib/i18n";
import { isLockEnabled, setLockEnabled, biometricsAvailable, authenticate } from "../../lib/lock";

const SUPPORT_PHONE = "08038830882";

export default function ProfileScreen() {
  const router = useRouter();
  const { lang, setLang } = useI18n();
  const [user, setUser] = useState<MobileUser | null>(null);
  const [lock, setLock] = useState(false);
  const [bioAvail, setBioAvail] = useState(false);

  const load = useCallback(async () => {
    const u = await getStoredUser();
    if (!u) { router.replace("/login"); return; }
    setUser(u);
    setLock(await isLockEnabled());
    setBioAvail(await biometricsAvailable());
  }, [router]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!user) return <Loading />;

  async function toggleLock(v: boolean) {
    if (v && !bioAvail) return Alert.alert("Not available", "Set up a fingerprint or face unlock on your phone first.");
    if (v && !(await authenticate())) return;
    await setLockEnabled(v); setLock(v);
  }

  async function signOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } },
    ]);
  }

  return (
    <Screen>
      <Card>
        <Row gap={space.md}>
          <Avatar name={user.name} size={56} />
          <View style={{ flex: 1 }}>
            <Txt variant="h2">{user.name}</Txt>
            <Txt variant="small" color={colors.muted}>{user.staffNo ?? "—"} · {user.phone}</Txt>
          </View>
        </Row>
        <Divider />
        <View style={{ marginTop: space.md, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {user.roles.map((r) => (
            <View key={r} style={{ backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Txt variant="tiny" color={colors.accentDark}>{r.replace(/_/g, " ")}</Txt>
            </View>
          ))}
        </View>
      </Card>

      <View>
        <SectionHeader title="Language" />
        <Card style={{ padding: space.sm }}>
          {LANGUAGES.map((l, i) => (
            <View key={l.code}>
              <Pressable onPress={() => setLang(l.code)} style={({ pressed }) => [{ padding: space.md }, pressed && { opacity: 0.6 }]}>
                <Row justify="space-between">
                  <Txt variant="body">{l.label}</Txt>
                  {lang === l.code && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
                </Row>
              </Pressable>
              {i < LANGUAGES.length - 1 && <Divider />}
            </View>
          ))}
        </Card>
      </View>

      <View>
        <SectionHeader title="Security" />
        <Card>
          <Row justify="space-between">
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">App lock</Txt>
              <Txt variant="small" color={colors.muted}>Require fingerprint / face unlock to open the app.</Txt>
            </View>
            <Switch value={lock} onValueChange={toggleLock} trackColor={{ true: colors.accent }} />
          </Row>
        </Card>
      </View>

      <View>
        <SectionHeader title="Support" />
        <Card style={{ padding: 0 }}>
          <SettingRow icon="cloud-upload-outline" label="Offline sync" onPress={() => router.push("/outbox")} />
          <Divider />
          <SettingRow icon="call-outline" label={`Call support · ${SUPPORT_PHONE}`} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
          <Divider />
          <SettingRow icon="log-out-outline" label="Sign out" tint={colors.destructive} onPress={signOut} />
        </Card>
      </View>

      <Txt variant="tiny" color={colors.mutedLight} center>Zyntomax Admin · v0.1.0</Txt>
    </Screen>
  );
}

function SettingRow({ icon, label, onPress, tint }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; tint?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ paddingHorizontal: space.lg, paddingVertical: 14 }, pressed && { opacity: 0.6 }]}>
      <Row gap={space.md}>
        <Ionicons name={icon} size={20} color={tint ?? colors.muted} />
        <Txt variant="body" color={tint ?? colors.text} style={{ flex: 1 }}>{label}</Txt>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedLight} />
      </Row>
    </Pressable>
  );
}
