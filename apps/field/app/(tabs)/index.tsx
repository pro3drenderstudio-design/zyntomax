import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getStoredUser, getAdminDashboard, type MobileUser, type AdminDashboard } from "../../lib/api";
import { getQueue } from "../../lib/queue";
import { visibleSections } from "../../lib/modules";
import { Card, Txt, Row, Loading, SectionHeader } from "../../lib/ui";
import { colors, space, radius, type as ty } from "../../lib/theme";
import { naira, kg } from "../../lib/format";

const MANAGER_ROLES = ["OPERATIONS_MANAGER", "FACTORY_SUPERVISOR", "FINANCE_ADMIN", "SUPER_ADMIN"];

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<MobileUser | null>(null);
  const [dash, setDash] = useState<AdminDashboard | null>(null);
  const [pending, setPending] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    const u = await getStoredUser();
    if (!u) { router.replace("/login"); return; }
    setUser(u);
    setPending((await getQueue()).length);
    if (u.roles.some((r) => MANAGER_ROLES.includes(r))) {
      try { setDash(await getAdminDashboard()); } catch { /* not authorized / offline */ }
    }
    setChecked(true);
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!checked) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><Loading /></SafeAreaView>;

  const roles = user?.roles ?? [];
  const isManager = roles.some((r) => MANAGER_ROLES.includes(r));
  const quickActions = visibleSections(roles).flatMap((s) => s.items).filter((i) => i.built).slice(0, 6);
  const approvals = (dash?.approvals.reconciledTrips.length ?? 0) + (dash?.approvals.readyBatches.length ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ backgroundColor: colors.accent }}>
        <SafeAreaView edges={["top"]}>
          <View style={{ padding: space.lg, paddingBottom: space.xl }}>
            <Row justify="space-between">
              <View style={{ flex: 1 }}>
                <Text style={[ty.small, { color: "rgba(255,255,255,0.85)" }]}>Zyntomax Admin</Text>
                <Text style={[ty.h1, { color: "#fff" }]} numberOfLines={1}>{user?.name ?? "Staff"}</Text>
                <Text style={[ty.small, { color: "rgba(255,255,255,0.85)", marginTop: 2 }]} numberOfLines={1}>
                  {roles.map((r) => r.replace(/_/g, " ").toLowerCase()).join(" · ")}
                </Text>
              </View>
              <Pressable onPress={() => router.push("/profile")}>
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
        {/* Manager KPIs */}
        {isManager && dash && (
          <>
            <Row gap={space.md}>
              <Card style={{ flex: 1 }}>
                <Txt variant="tiny" color={colors.muted}>COLLECTED TODAY</Txt>
                <Txt variant="h2">{kg(dash.kpis.collectedTodayKg)}</Txt>
                <Txt variant="small" color={colors.muted}>{naira(dash.kpis.collectedTodayNaira)}</Txt>
              </Card>
              <Card style={{ flex: 1 }}>
                <Txt variant="tiny" color={colors.muted}>WALLET</Txt>
                <Txt variant="h2" color={dash.kpis.walletBalance <= 0 ? colors.destructive : colors.accent}>{naira(dash.kpis.walletBalance)}</Txt>
                <Txt variant="small" color={colors.muted}>{dash.kpis.activeTrips} active trips</Txt>
              </Card>
            </Row>
            <Row gap={space.md}>
              <MiniStat label="Intake" value={kg(dash.kpis.intakeKg)} />
              <MiniStat label="In process" value={kg(dash.kpis.wipKg)} />
              <MiniStat label="Finished" value={kg(dash.kpis.finishedKg)} />
            </Row>
            {(approvals > 0 || dash.kpis.flaggedJobs > 0) && (
              <Card onPress={() => router.push("/admin")} style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
                <Row justify="space-between">
                  <Txt variant="bodyStrong" color={colors.warning}>
                    {approvals > 0 ? `${approvals} item${approvals > 1 ? "s" : ""} awaiting approval` : `${dash.kpis.flaggedJobs} flagged job${dash.kpis.flaggedJobs > 1 ? "s" : ""}`}
                  </Txt>
                  <Ionicons name="chevron-forward" size={18} color={colors.warning} />
                </Row>
              </Card>
            )}
          </>
        )}

        {/* Offline sync */}
        {pending > 0 && (
          <Card onPress={() => router.push("/outbox")} style={{ backgroundColor: colors.infoSoft, borderColor: colors.infoSoft }}>
            <Row justify="space-between">
              <Row gap={space.sm}>
                <Ionicons name="cloud-upload" size={18} color={colors.info} />
                <Txt variant="bodyStrong" color={colors.info}>{pending} record{pending > 1 ? "s" : ""} waiting to sync</Txt>
              </Row>
              <Ionicons name="chevron-forward" size={18} color={colors.info} />
            </Row>
          </Card>
        )}

        {/* Quick actions */}
        <View>
          <SectionHeader title="Quick actions" action={<Pressable onPress={() => router.push("/manage")}><Txt variant="smallStrong" color={colors.accent}>All</Txt></Pressable>} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            {quickActions.map((a) => (
              <Pressable key={a.key} onPress={() => router.push(a.href as never)} style={({ pressed }) => [{ width: "47%", flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: 8 }, pressed && { opacity: 0.7 }]}>
                <Ionicons name={a.icon} size={24} color={colors.accent} />
                <Text style={ty.bodyStrong}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, padding: space.md }}>
      <Txt variant="tiny" color={colors.muted}>{label.toUpperCase()}</Txt>
      <Txt variant="h3">{value}</Txt>
    </Card>
  );
}
