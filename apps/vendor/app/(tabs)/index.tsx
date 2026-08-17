import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getHome, getStoredVendor, type VendorHome } from "../../lib/api";
import { Card, Txt, Row, Badge, Loading, SectionHeader, EmptyState } from "../../lib/ui";
import { colors, space, radius, type as t } from "../../lib/theme";
import { naira, kg, shortDate } from "../../lib/format";

export default function HomeScreen() {
  const router = useRouter();
  const [home, setHome] = useState<VendorHome | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    const v = await getStoredVendor();
    if (!v) { router.replace("/login"); return; }
    try { setHome(await getHome()); } catch { /* keep last */ }
    setChecked(true);
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!checked) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><Loading /></SafeAreaView>;

  const next = home?.rewards.next;
  const progress = next && home ? Math.min(1, home.lifetimeKg / next.thresholdKg) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Hero */}
      <View style={{ backgroundColor: colors.accent, paddingTop: 0 }}>
        <SafeAreaView edges={["top"]}>
          <View style={{ padding: space.lg, paddingBottom: space.xl }}>
            <Row justify="space-between">
              <View>
                <Text style={[t.small, { color: "rgba(255,255,255,0.85)" }]}>Welcome back</Text>
                <Text style={[t.h1, { color: "#fff" }]} numberOfLines={1}>{home?.vendor.name ?? "Vendor"}</Text>
                <Text style={[t.small, { color: "rgba(255,255,255,0.85)", marginTop: 2 }]}>
                  {home?.vendor.vendorNo ?? ""}{home?.vendor.locality ? ` · ${home.vendor.locality}` : ""}
                </Text>
              </View>
              <Pressable onPress={() => router.push("/profile")} accessibilityLabel="Profile">
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="person" size={22} color="#fff" />
                </View>
              </Pressable>
            </Row>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: -space.lg }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.accent} colors={[colors.accent]} />}
      >
        {/* Stats card */}
        <Card style={{ flexDirection: "row" }}>
          <View style={{ flex: 1 }}>
            <Txt variant="tiny" color={colors.muted}>RECYCLED</Txt>
            <Txt variant="h1">{kg(home?.lifetimeKg ?? 0)}</Txt>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: space.md }} />
          <View style={{ flex: 1 }}>
            <Txt variant="tiny" color={colors.muted}>EARNED</Txt>
            <Txt variant="h1" color={colors.accent}>{naira(home?.lifetimeNaira ?? 0)}</Txt>
          </View>
        </Card>

        {/* Primary CTA */}
        <Pressable onPress={() => router.push("/pickup/new")} style={({ pressed }) => [{ backgroundColor: colors.accent, borderRadius: radius.lg, padding: space.lg }, pressed && { opacity: 0.9 }]}>
          <Row justify="space-between">
            <Row gap={space.md}>
              <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="camera" size={24} color="#fff" />
              </View>
              <View>
                <Text style={[t.h3, { color: "#fff" }]}>Request a pickup</Text>
                <Text style={[t.small, { color: "rgba(255,255,255,0.85)" }]}>Snap your recyclables — we come to you</Text>
              </View>
            </Row>
            <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.9)" />
          </Row>
        </Pressable>

        {/* Quick actions */}
        <Row gap={space.md}>
          <QuickAction icon="cube-outline" label="Pickups" onPress={() => router.push("/pickups")} />
          <QuickAction icon="wallet-outline" label="Wallet" onPress={() => router.push("/wallet")} />
          <QuickAction icon="gift-outline" label="Rewards" onPress={() => router.push("/profile")} />
        </Row>

        {/* Reward progress */}
        {next && (
          <Card>
            <Row justify="space-between">
              <Txt variant="bodyStrong">Next reward: {next.name}</Txt>
              <Ionicons name="gift" size={18} color={colors.accent} />
            </Row>
            <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>{next.reward}</Txt>
            <View style={{ height: 10, backgroundColor: colors.limeSoft, borderRadius: 6, marginVertical: space.sm, overflow: "hidden" }}>
              <View style={{ height: 10, width: `${progress * 100}%`, backgroundColor: colors.accent, borderRadius: 6 }} />
            </View>
            <Txt variant="small" color={colors.muted}>{kg(next.remainingKg)} more to unlock</Txt>
          </Card>
        )}

        {/* Recent collections */}
        <View>
          <SectionHeader title="Recent collections" action={
            <Pressable onPress={() => router.push("/wallet")}><Txt variant="smallStrong" color={colors.accent}>See all</Txt></Pressable>
          } />
          {home && home.collections.length > 0 ? (
            <Card style={{ padding: space.sm }}>
              {home.collections.slice(0, 5).map((c, i) => (
                <View key={c.id}>
                  <Row justify="space-between" style={{ padding: space.md }}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong" numberOfLines={1}>{c.material}</Txt>
                      <Txt variant="small" color={colors.muted}>{kg(c.weightKg)} · {shortDate(c.date)}</Txt>
                    </View>
                    <Txt variant="bodyStrong" color={colors.accent}>{naira(c.amount)}</Txt>
                  </Row>
                  {i < Math.min(4, home.collections.length - 1) && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: space.md }} />}
                </View>
              ))}
            </Card>
          ) : (
            <Card><EmptyState icon={<Ionicons name="leaf-outline" size={32} color={colors.mutedLight} />} title="No collections yet" subtitle="Request a pickup to start recycling and earning." /></Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: space.lg, alignItems: "center", gap: 6 }, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={24} color={colors.accent} />
      <Text style={t.smallStrong}>{label}</Text>
    </Pressable>
  );
}
