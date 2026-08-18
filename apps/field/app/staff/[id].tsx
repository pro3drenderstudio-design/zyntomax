import { useCallback, useState } from "react";
import { View, Alert } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getStaffMember, setStaffStatus, type StaffDetail } from "../../lib/api";
import { Screen, Card, Txt, Row, Badge, Avatar, Button, StatCard, Loading, Divider } from "../../lib/ui";
import { colors, space } from "../../lib/theme";
import { naira, shortDate } from "../../lib/format";

const WAGE_LABEL: Record<string, string> = {
  COMMISSION: "Commission (piece-rate)", SALARY: "Weekly salary", COMMISSION_PLUS_BASE: "Commission + base",
};

export default function StaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<StaffDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setS(await getStaffMember(id)); } catch { setS(null); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (s === null) return <Loading />;

  async function toggleStatus() {
    if (!s) return;
    const next = s.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    Alert.alert(next === "SUSPENDED" ? "Suspend staff?" : "Reactivate staff?", `${s.name} will be set to ${next}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: next === "SUSPENDED" ? "Suspend" : "Reactivate",
        style: next === "SUSPENDED" ? "destructive" : "default",
        onPress: async () => {
          setBusy(true);
          try { await setStaffStatus(s.id, next); await load(); }
          catch (e) { Alert.alert("Failed", e instanceof Error ? e.message : "Could not update"); }
          finally { setBusy(false); }
        },
      },
    ]);
  }

  return (
    <Screen>
      <Card>
        <Row gap={space.md}>
          <Avatar name={s.name} size={56} />
          <View style={{ flex: 1 }}>
            <Txt variant="h3">{s.name}</Txt>
            <Txt variant="small" color={colors.muted}>{s.staffNo}{s.title ? ` · ${s.title}` : ""}</Txt>
            <Row gap={space.xs} style={{ marginTop: 6 }}>
              <Badge label={s.status} status={s.status} />
              {s.hireDate ? <Txt variant="tiny" color={colors.mutedLight}>Hired {shortDate(s.hireDate)}</Txt> : null}
            </Row>
          </View>
        </Row>
        <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: space.md }}>{s.phone}</Txt>
      </Card>

      <Row gap={space.sm}>
        <StatCard label="Earned (recent)" value={naira(s.totalEarned)} />
        <StatCard label="Advance owed" value={naira(s.outstandingAdvance)} tone={s.outstandingAdvance > 0 ? "default" : "accent"} />
      </Row>

      <Card>
        <Txt variant="tiny" color={colors.muted}>WAGE MODEL</Txt>
        <Txt variant="body" style={{ marginTop: 2 }}>{WAGE_LABEL[s.wageModel] ?? s.wageModel}</Txt>
        {s.baseSalaryWeekly ? <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>Weekly base {naira(s.baseSalaryWeekly)}</Txt> : null}
      </Card>

      {s.payslips.length > 0 && (
        <Card>
          <Txt variant="smallStrong" style={{ marginBottom: 4 }}>Recent payslips</Txt>
          {s.payslips.map((p, i) => (
            <View key={p.id}>
              {i > 0 && <Divider />}
              <Row justify="space-between" style={{ paddingVertical: space.sm }}>
                <View>
                  <Txt variant="body">Week of {shortDate(p.weekStart)}</Txt>
                  <Txt variant="tiny" color={colors.mutedLight}>Earned {naira(p.earnedAmount)}{p.advanceDeduction ? ` · adv −${naira(p.advanceDeduction)}` : ""}</Txt>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Txt variant="bodyStrong">{naira(p.netAmount)}</Txt>
                  <Badge label={p.paid ? "Paid" : "Unpaid"} status={p.paid ? "PAID" : "PENDING"} />
                </View>
              </Row>
            </View>
          ))}
        </Card>
      )}

      {s.status !== "EXITED" && (
        <Button
          title={s.status === "ACTIVE" ? "Suspend staff" : "Reactivate staff"}
          variant={s.status === "ACTIVE" ? "destructive" : "primary"}
          loading={busy}
          onPress={toggleStatus}
        />
      )}
      <Txt variant="tiny" color={colors.mutedLight}>Full profile edits, roles and wage changes are on the web app.</Txt>
    </Screen>
  );
}
