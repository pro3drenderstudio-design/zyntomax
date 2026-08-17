import { useCallback, useState } from "react";
import { View, Share, Pressable, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { getReferral } from "../lib/api";
import { Screen, Card, Txt, Row, Button, Loading } from "../lib/ui";
import { colors, space, radius } from "../lib/theme";

export default function ReferralScreen() {
  const [data, setData] = useState<{ code: string | null; referredCount: number } | null>(null);
  const load = useCallback(async () => { try { setData(await getReferral()); } catch { /* keep */ } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!data) return <Loading />;

  const code = data.code ?? "…";
  const message = `Join me on Zyntomax and turn your recyclables into cash! Use my referral code ${code} when you sign up. Download the app to get started.`;

  return (
    <Screen>
      <Card>
        <Row gap={space.sm}><Ionicons name="gift" size={22} color={colors.accent} /><Txt variant="h3">Invite & earn</Txt></Row>
        <Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>
          Share your code with other recyclers. When they join and start selling, you both earn a bonus.
        </Txt>
      </Card>

      <Card>
        <Txt variant="tiny" color={colors.muted}>YOUR REFERRAL CODE</Txt>
        <Pressable onPress={async () => { await Clipboard.setStringAsync(code); Alert.alert("Copied", "Referral code copied."); }}>
          <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.md, paddingVertical: space.lg, alignItems: "center", marginTop: space.sm }}>
            <Txt variant="display" color={colors.accentDark}>{code}</Txt>
            <Txt variant="tiny" color={colors.accentDark}>TAP TO COPY</Txt>
          </View>
        </Pressable>
      </Card>

      <Card>
        <Row justify="space-between">
          <Txt variant="body">Vendors you've referred</Txt>
          <Txt variant="h3" color={colors.accent}>{data.referredCount}</Txt>
        </Row>
      </Card>

      <Button title="Share invite" icon={<Ionicons name="share-social" size={18} color="#fff" />} onPress={() => Share.share({ message })} />
    </Screen>
  );
}
