import { useCallback, useState } from "react";
import { View, Linking, Alert } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  getVendor, approveVendor, rejectVendor, setVendorStatus, deleteVendor, getStoredUser, type VendorDetail,
} from "../../lib/api";
import { navigateTo } from "../../lib/navigate";
import { MiniMap } from "../../lib/map";
import { Screen, Card, Txt, Row, Badge, Button, StatCard, Avatar, Loading, Divider } from "../../lib/ui";
import { colors, space } from "../../lib/theme";
import { naira, kg, shortDate, relativeDate } from "../../lib/format";

const has = (roles: string[], ...want: string[]) => roles.includes("SUPER_ADMIN") || want.some((r) => roles.includes(r));

export default function VendorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [v, setV] = useState<VendorDetail | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setV(await getVendor(id)); } catch { setV(null); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); getStoredUser().then((u) => setRoles(u?.roles ?? [])); }, [load]));
  if (v === null) return <Loading />;

  const canApprove = has(roles, "OPERATIONS_MANAGER", "HR_ADMIN");
  const canStatus = has(roles, "OPERATIONS_MANAGER");
  const canEdit = has(roles, "OPERATIONS_MANAGER", "TEAM_LEAD");

  async function run(fn: () => Promise<unknown>, okMsg: string, back?: boolean) {
    setBusy(true);
    try { await fn(); if (back) { router.back(); } else { await load(); } if (okMsg) Alert.alert(okMsg); }
    catch (e) { Alert.alert("Failed", e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  }

  function onApprove() {
    Alert.alert("Approve vendor?", `${v!.name} will be able to sign in and start recycling.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => run(() => approveVendor(v!.id), "Vendor approved") },
    ]);
  }
  function onReject() {
    Alert.alert("Reject vendor?", `${v!.name}'s pending registration will be deleted.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => run(() => rejectVendor(v!.id), "Registration rejected", true) },
    ]);
  }
  function onStatus() {
    const opts: { text: string; style?: "destructive" | "cancel"; onPress?: () => void }[] = [];
    if (v!.status !== "ACTIVE") opts.push({ text: "Set Active", onPress: () => run(() => setVendorStatus(v!.id, "ACTIVE"), "Vendor activated") });
    if (v!.status !== "INACTIVE") opts.push({ text: "Set Inactive", onPress: () => run(() => setVendorStatus(v!.id, "INACTIVE"), "Vendor deactivated") });
    if (v!.status !== "BLACKLISTED") opts.push({ text: "Blacklist", style: "destructive", onPress: () => run(() => setVendorStatus(v!.id, "BLACKLISTED"), "Vendor blacklisted") });
    opts.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Change status", `Current: ${v!.status}`, opts);
  }
  function onDelete() {
    Alert.alert("Delete vendor?", "If the vendor has collection history they'll be blacklisted instead of deleted.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => run(() => deleteVendor(v!.id), "Done", true) },
    ]);
  }

  return (
    <Screen>
      <Card>
        <Row gap={space.md}>
          <Avatar name={v.name} uri={v.photoUrl} size={56} />
          <View style={{ flex: 1 }}>
            <Row justify="space-between">
              <Txt variant="h3">{v.name}</Txt>
              <Badge label={v.status} status={v.status} />
            </Row>
            <Txt variant="small" color={colors.muted}>{v.vendorNo ? `${v.vendorNo} · ` : ""}{v.phone}</Txt>
            {v.nickname ? <Txt variant="tiny" color={colors.mutedLight}>“{v.nickname}”</Txt> : null}
            <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: 2 }}>{v.locality ?? "No locality"} · joined {shortDate(v.createdAt)}</Txt>
          </View>
        </Row>
        <Row gap={space.sm} style={{ marginTop: space.md }}>
          <View style={{ flex: 1 }}><Button title="Call" small variant="secondary" icon={<Ionicons name="call-outline" size={16} color={colors.text} />} onPress={() => Linking.openURL(`tel:${v.phone}`)} /></View>
          {v.lat != null && v.lng != null && <View style={{ flex: 1 }}><Button title="Navigate" small variant="secondary" icon={<Ionicons name="navigate-outline" size={16} color={colors.text} />} onPress={() => navigateTo(v.lat!, v.lng!, v.name)} /></View>}
          {canEdit && <View style={{ flex: 1 }}><Button title="Edit" small variant="secondary" icon={<Ionicons name="create-outline" size={16} color={colors.text} />} onPress={() => router.push(`/vendor/${v.id}/edit` as never)} /></View>}
        </Row>
      </Card>

      {/* Pending approval actions */}
      {v.status === "PENDING" && canApprove && (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
          <Txt variant="bodyStrong" color={colors.warning}>Awaiting approval</Txt>
          <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>This vendor self-registered in the app.</Txt>
          <Row gap={space.sm} style={{ marginTop: space.md }}>
            <View style={{ flex: 1 }}><Button title="Approve" loading={busy} onPress={onApprove} icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />} /></View>
            <View style={{ flex: 1 }}><Button title="Reject" variant="destructive" disabled={busy} onPress={onReject} /></View>
          </Row>
        </Card>
      )}

      {/* Wallet */}
      <StatCard label="Wallet available" value={naira(v.wallet.available)} tone="accent" hint={`earned ${naira(v.wallet.earned)} · withdrawn ${naira(v.wallet.withdrawn)}`} />
      <Row gap={space.sm}>
        <StatCard label="Lifetime collected" value={kg(v.lifetimeKg)} />
        <StatCard label="Bank" value={v.bankVerified ? "Verified" : "Unverified"} hint={v.bankName ?? undefined} tone={v.bankVerified ? "accent" : "default"} />
      </Row>

      {v.bankAccountName ? (
        <Card>
          <Txt variant="tiny" color={colors.muted}>BANK ACCOUNT</Txt>
          <Txt variant="body" style={{ marginTop: 2 }}>{v.bankAccountName}</Txt>
          <Txt variant="small" color={colors.muted}>{v.bankName ?? ""}{v.bankAccountNo ? ` · ${v.bankAccountNo}` : ""}</Txt>
        </Card>
      ) : null}

      {v.lat != null && v.lng != null && (
        <Card>
          <Txt variant="smallStrong" style={{ marginBottom: 6 }}>Location</Txt>
          <MiniMap points={[{ lat: v.lat, lng: v.lng, label: v.name, color: colors.accent }]} height={150} />
          {v.address ? <Txt variant="small" color={colors.muted} style={{ marginTop: 6 }}>{v.address}</Txt> : null}
        </Card>
      )}

      {/* Weigh-ins */}
      {v.weighIns.length > 0 && (
        <Card>
          <Txt variant="smallStrong" style={{ marginBottom: 4 }}>Recent collections</Txt>
          {v.weighIns.slice(0, 12).map((w, i) => (
            <View key={w.id}>
              {i > 0 && <Divider />}
              <Row justify="space-between" style={{ paddingVertical: space.sm }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Txt variant="body">{w.material}</Txt>
                  <Txt variant="tiny" color={colors.mutedLight}>{kg(w.weightKg)} × {naira(w.ratePerKg)} · {relativeDate(w.createdAt)}</Txt>
                </View>
                <Txt variant="bodyStrong">{naira(w.amount)}</Txt>
              </Row>
            </View>
          ))}
        </Card>
      )}

      {/* Withdrawals */}
      {v.withdrawals.length > 0 && (
        <Card>
          <Txt variant="smallStrong" style={{ marginBottom: 4 }}>Withdrawals</Txt>
          {v.withdrawals.map((w, i) => (
            <View key={w.id}>
              {i > 0 && <Divider />}
              <Row justify="space-between" style={{ paddingVertical: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="body">{naira(w.amount)}</Txt>
                  <Txt variant="tiny" color={colors.mutedLight}>{relativeDate(w.requestedAt)}{w.failureReason ? ` · ${w.failureReason}` : ""}</Txt>
                </View>
                <Badge label={w.status} status={w.status} />
              </Row>
            </View>
          ))}
        </Card>
      )}

      {/* Status / delete actions */}
      {canStatus && v.status !== "PENDING" && (
        <Row gap={space.sm}>
          <View style={{ flex: 1 }}><Button title="Change status" variant="secondary" disabled={busy} onPress={onStatus} icon={<Ionicons name="swap-horizontal" size={16} color={colors.text} />} /></View>
          <View style={{ flex: 1 }}><Button title="Delete" variant="destructive" disabled={busy} onPress={onDelete} /></View>
        </Row>
      )}
    </Screen>
  );
}
