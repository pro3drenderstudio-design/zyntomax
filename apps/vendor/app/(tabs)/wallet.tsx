import { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getWallet, type WalletData } from "../../lib/api";
import { Screen, Card, Txt, Row, Badge, Button, EmptyState, Loading, SectionHeader } from "../../lib/ui";
import { colors, space, radius, type as t } from "../../lib/theme";
import { naira, shortDate } from "../../lib/format";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Processing", APPROVED: "Processing", PAID: "Paid", REJECTED: "Rejected", FAILED: "Failed",
};

export default function WalletScreen() {
  const router = useRouter();
  const [w, setW] = useState<WalletData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { try { setW(await getWallet()); } catch { /* keep */ } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!w) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      {/* Balance card */}
      <View style={{ backgroundColor: colors.accent, borderRadius: radius.lg, padding: space.lg }}>
        <Txt variant="tiny" color="rgba(255,255,255,0.85)">AVAILABLE TO WITHDRAW</Txt>
        <Text style={[t.display, { color: "#fff", marginTop: 4 }]}>{naira(w.available)}</Text>
        <Row gap={space.sm} style={{ marginTop: space.md }}>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.md, padding: space.md }}>
            <Txt variant="tiny" color="rgba(255,255,255,0.8)">LIFETIME EARNED</Txt>
            <Txt variant="h3" color="#fff">{naira(w.earned)}</Txt>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.md, padding: space.md }}>
            <Txt variant="tiny" color="rgba(255,255,255,0.8)">WITHDRAWN</Txt>
            <Txt variant="h3" color="#fff">{naira(w.withdrawn + w.paidOut)}</Txt>
          </View>
        </Row>
      </View>

      {/* Withdraw action / bank prompt */}
      {w.bank.verified ? (
        <Card>
          <Row justify="space-between">
            <View>
              <Txt variant="small" color={colors.muted}>Withdraw to</Txt>
              <Txt variant="bodyStrong">{w.bank.bankName} ••{w.bank.last4}</Txt>
              {w.bank.accountName ? <Txt variant="small" color={colors.muted}>{w.bank.accountName}</Txt> : null}
            </View>
            <Ionicons name="shield-checkmark" size={22} color={colors.success} />
          </Row>
          <View style={{ height: space.md }} />
          <Button
            title={w.available >= w.minWithdrawal ? "Withdraw to bank" : `Min ₦${w.minWithdrawal.toLocaleString()}`}
            icon={<Ionicons name="cash" size={18} color="#fff" />}
            disabled={w.available < w.minWithdrawal}
            onPress={() => router.push("/withdraw")}
          />
        </Card>
      ) : (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
          <Row gap={space.sm} align="flex-start">
            <Ionicons name="alert-circle" size={20} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong" color={colors.warning}>Add your bank account</Txt>
              <Txt variant="small" color={colors.warning} style={{ marginTop: 2 }}>Verify a bank account so you can withdraw your earnings.</Txt>
              <View style={{ height: space.sm }} />
              <Button title="Set up bank account" small variant="secondary" onPress={() => router.push("/account/kyc")} />
            </View>
          </Row>
        </Card>
      )}

      {/* Withdrawal history */}
      <View>
        <SectionHeader title="Withdrawals" />
        {w.withdrawals.length === 0 ? (
          <Card><EmptyState icon={<Ionicons name="wallet-outline" size={32} color={colors.mutedLight} />} title="No withdrawals yet" subtitle="When you cash out, your withdrawals show up here." /></Card>
        ) : (
          <Card style={{ padding: space.sm }}>
            {w.withdrawals.map((wd, i) => (
              <View key={wd.id}>
                <Row justify="space-between" style={{ padding: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{naira(wd.amount)}</Txt>
                    <Txt variant="small" color={colors.muted}>{shortDate(wd.requestedAt)}{wd.bankName ? ` · ${wd.bankName} ••${wd.last4}` : ""}</Txt>
                    {wd.failureReason ? <Txt variant="small" color={colors.destructive}>{wd.failureReason}</Txt> : null}
                  </View>
                  <Badge label={STATUS_LABEL[wd.status] ?? wd.status} status={wd.status} />
                </Row>
                {i < w.withdrawals.length - 1 && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: space.md }} />}
              </View>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
