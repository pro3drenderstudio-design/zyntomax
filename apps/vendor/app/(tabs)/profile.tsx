import { useCallback, useState } from "react";
import { View, Pressable, Alert, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getHome, logout, type VendorHome } from "../../lib/api";
import { Screen, Card, Txt, Row, Avatar, Badge, Divider, Loading, SectionHeader } from "../../lib/ui";
import { colors, space } from "../../lib/theme";
import { kg } from "../../lib/format";
import { useI18n } from "../../lib/i18n";

const SUPPORT_PHONE = "08038830882";

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [home, setHome] = useState<VendorHome | null>(null);

  const load = useCallback(async () => { try { setHome(await getHome()); } catch { /* keep */ } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!home) return <Loading />;

  const v = home.vendor;

  async function signOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } },
    ]);
  }

  return (
    <Screen>
      {/* Identity */}
      <Card>
        <Row gap={space.md}>
          <Avatar name={v.name} size={56} />
          <View style={{ flex: 1 }}>
            <Txt variant="h2">{v.name}</Txt>
            <Txt variant="small" color={colors.muted}>{v.vendorNo ?? "—"} · {v.phone}</Txt>
            {v.locality ? <Txt variant="small" color={colors.muted}>{v.locality}</Txt> : null}
          </View>
        </Row>
        <Divider />
        <Row justify="space-between" style={{ marginTop: space.md }}>
          <Txt variant="small" color={colors.muted}>Bank account</Txt>
          {v.bankVerified ? (
            <Badge label={`Verified · ${v.bankName ?? "Bank"}`} status="ACTIVE" />
          ) : (
            <Badge label="Not set up" status="PENDING" />
          )}
        </Row>
      </Card>

      {/* Rewards */}
      <View>
        <SectionHeader title={t("rewards")} />
        <Card style={{ padding: space.sm }}>
          {home.rewards.tiers.length === 0 ? (
            <Txt variant="small" color={colors.muted} style={{ padding: space.md }}>No reward tiers yet.</Txt>
          ) : home.rewards.tiers.map((tier, i) => (
            <View key={tier.name}>
              <Row justify="space-between" style={{ padding: space.md }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{tier.name}</Txt>
                  <Txt variant="small" color={colors.muted}>{tier.reward} · {kg(tier.thresholdKg)}</Txt>
                </View>
                {tier.earned
                  ? <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                  : <Ionicons name="lock-closed" size={18} color={colors.mutedLight} />}
              </Row>
              {i < home.rewards.tiers.length - 1 && <Divider />}
            </View>
          ))}
        </Card>
      </View>

      {/* Settings */}
      <View>
        <SectionHeader title={t("account")} />
        <Card style={{ padding: 0 }}>
          <SettingRow icon="create-outline" label={t("edit_profile")} onPress={() => router.push("/account/edit")} />
          <Divider />
          <SettingRow icon="shield-checkmark-outline" label={t("bank_kyc")} onPress={() => router.push("/account/kyc")} />
          <Divider />
          <SettingRow icon="stats-chart-outline" label={t("sales_history")} onPress={() => router.push("/history")} />
          <Divider />
          <SettingRow icon="pricetags-outline" label={t("todays_rates")} onPress={() => router.push("/rates")} />
          <Divider />
          <SettingRow icon="gift-outline" label={t("invite_earn")} onPress={() => router.push("/referral")} />
          <Divider />
          <SettingRow icon="settings-outline" label={t("settings_language")} onPress={() => router.push("/account/settings")} />
        </Card>
      </View>

      <View>
        <SectionHeader title={t("support")} />
        <Card style={{ padding: 0 }}>
          <SettingRow icon="call-outline" label={`Call us · ${SUPPORT_PHONE}`} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
          <Divider />
          <SettingRow icon="chatbubble-ellipses-outline" label={t("help_faq")} onPress={() => router.push("/help")} />
          <Divider />
          <SettingRow icon="log-out-outline" label={t("sign_out")} tint={colors.destructive} onPress={signOut} />
        </Card>
      </View>

      <Txt variant="tiny" color={colors.mutedLight} center>Zyntomax Vendor · v0.1.0</Txt>
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
