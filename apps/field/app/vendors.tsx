import { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getVendors, type VendorList, type VendorListItem } from "../lib/api";
import { navigateTo } from "../lib/navigate";
import { Screen, Card, Txt, Row, Badge, Button, Field, Avatar, EmptyState, Loading } from "../lib/ui";
import { colors, space, radius } from "../lib/theme";
import { kg } from "../lib/format";

const TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Inactive" },
  { key: "BLACKLISTED", label: "Blacklisted" },
];

export default function VendorsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<VendorList | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (opts?: { status?: string; q?: string }) => {
    try { setData(await getVendors({ status: opts?.status ?? status, q: opts?.q ?? q })); }
    catch { setData({ total: 0, pendingCount: 0, page: 0, hasMore: false, vendors: [] }); }
  }, [status, q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Debounced search
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { load({ q }); }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  if (data === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Button title="Register a vendor" icon={<Ionicons name="person-add" size={18} color="#fff" />} onPress={() => router.push("/vendor-new")} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {TABS.map((t) => {
          const active = status === t.key;
          const showBadge = t.key === "PENDING" && data.pendingCount > 0;
          return (
            <Pressable key={t.key} onPress={() => { setStatus(t.key); load({ status: t.key }); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Txt variant="small" color={active ? colors.accentDark : colors.text}>{t.label}</Txt>
              {showBadge && <View style={{ backgroundColor: colors.warning, borderRadius: 9, minWidth: 18, paddingHorizontal: 5, alignItems: "center" }}><Txt variant="tiny" color="#fff">{data.pendingCount}</Txt></View>}
            </Pressable>
          );
        })}
      </View>

      <Field value={q} onChangeText={setQ} placeholder="Search name, phone or ID…" />

      {data.vendors.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="people-outline" size={32} color={colors.mutedLight} />} title="No vendors found" /></Card>
      ) : (
        data.vendors.map((v) => <VendorRow key={v.id} v={v} onOpen={() => router.push(`/vendor/${v.id}` as never)} />)
      )}
      {data.hasMore && <Txt variant="tiny" color={colors.mutedLight} center>Showing first {data.vendors.length} of {data.total} — refine your search to narrow down.</Txt>}
    </Screen>
  );
}

function VendorRow({ v, onOpen }: { v: VendorListItem; onOpen: () => void }) {
  return (
    <Card onPress={onOpen}>
      <Row gap={space.md}>
        <Avatar name={v.name} uri={v.photoUrl} size={44} />
        <View style={{ flex: 1 }}>
          <Row justify="space-between">
            <Txt variant="bodyStrong">{v.name}</Txt>
            <Badge label={v.status} status={v.status} />
          </Row>
          <Txt variant="small" color={colors.muted}>{v.vendorNo ? `${v.vendorNo} · ` : ""}{v.phone}</Txt>
          <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: 2 }}>
            {v.locality ?? "No locality"} · {kg(v.lifetimeKg)} lifetime{v.bankVerified ? " · bank ✓" : ""}
          </Txt>
        </View>
      </Row>
      <Row gap={space.sm} style={{ marginTop: space.md }}>
        <View style={{ flex: 1 }}><Button title="Call" small variant="secondary" icon={<Ionicons name="call-outline" size={16} color={colors.text} />} onPress={() => Linking.openURL(`tel:${v.phone}`)} /></View>
        {v.lat != null && v.lng != null && (
          <View style={{ flex: 1 }}><Button title="Navigate" small variant="secondary" icon={<Ionicons name="navigate-outline" size={16} color={colors.text} />} onPress={() => navigateTo(v.lat!, v.lng!, v.name)} /></View>
        )}
      </Row>
    </Card>
  );
}
