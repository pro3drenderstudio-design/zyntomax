import { useEffect, useState } from "react";
import { View, Switch, Pressable, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, Txt, Row, Divider, SectionHeader } from "../../lib/ui";
import { colors, space } from "../../lib/theme";
import { useI18n, LANGUAGES } from "../../lib/i18n";
import { isLockEnabled, setLockEnabled, biometricsAvailable, authenticate } from "../../lib/lock";

export default function SettingsScreen() {
  const { lang, setLang } = useI18n();
  const [lock, setLock] = useState(false);
  const [bioAvail, setBioAvail] = useState(false);

  useEffect(() => { (async () => { setLock(await isLockEnabled()); setBioAvail(await biometricsAvailable()); })(); }, []);

  async function toggleLock(v: boolean) {
    if (v && !bioAvail) return Alert.alert("Not available", "Set up a fingerprint or face unlock on your phone first.");
    if (v && !(await authenticate())) return;
    await setLockEnabled(v); setLock(v);
  }

  return (
    <Screen>
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
        <SectionHeader title="Notifications" />
        <Card>
          <Txt variant="small" color={colors.muted}>
            You'll get alerts when a pickup is scheduled, a collector is on the way, and when payments land — as long as notifications are allowed for Zyntomax in your phone settings.
          </Txt>
        </Card>
      </View>

      <Txt variant="tiny" color={colors.mutedLight} center>Zyntomax Vendor · v0.1.0</Txt>
    </Screen>
  );
}
