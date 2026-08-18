import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getStaff, type StaffRow } from "../lib/api";
import { Screen, Card, Txt, Row, Badge, Avatar, Field, EmptyState, Loading } from "../lib/ui";
import { colors, space } from "../lib/theme";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super admin", OPERATIONS_MANAGER: "Ops", FACTORY_SUPERVISOR: "Supervisor",
  FINANCE_ADMIN: "Finance", PURCHASING_MANAGER: "Purchasing", HR_ADMIN: "HR", SALES_ADMIN: "Sales",
  TEAM_LEAD: "Team lead", COLLECTION_AGENT: "Collection", PRODUCTION_STAFF: "Production", AUDITOR: "Auditor",
};

export default function StaffScreen() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setStaff((await getStaff()).staff); } catch { setStaff([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (!staff) return [];
    const s = q.trim().toLowerCase();
    if (!s) return staff;
    return staff.filter((p) => p.name.toLowerCase().includes(s) || p.staffNo.toLowerCase().includes(s) || p.phone.includes(s));
  }, [staff, q]);

  if (staff === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Field value={q} onChangeText={setQ} placeholder="Search name, staff no or phone…" />
      {filtered.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="people-outline" size={32} color={colors.mutedLight} />} title="No staff found" /></Card>
      ) : filtered.map((p) => (
        <Card key={p.id} onPress={() => router.push(`/staff/${p.id}` as never)}>
          <Row gap={space.md}>
            <Avatar name={p.name} />
            <View style={{ flex: 1 }}>
              <Row justify="space-between">
                <Txt variant="bodyStrong">{p.name}</Txt>
                {p.status !== "ACTIVE" ? <Badge label={p.status} status={p.status} /> : null}
              </Row>
              <Txt variant="small" color={colors.muted}>{p.staffNo}{p.title ? ` · ${p.title}` : ""}</Txt>
              <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: 2 }}>
                {p.roles.map((r) => ROLE_LABEL[r] ?? r).join(" · ")}
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedLight} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
