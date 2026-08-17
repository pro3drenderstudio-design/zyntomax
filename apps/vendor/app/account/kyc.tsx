import { useCallback, useState } from "react";
import { View, Pressable, ScrollView, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getHome, getBanks, verifyBank, type Bank } from "../../lib/api";
import { Screen, Card, Txt, Row, Button, Field, ErrorText, Loading, Divider } from "../../lib/ui";
import { colors, space, radius } from "../../lib/theme";

export default function KycScreen() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState<{ verified: boolean; bankName: string | null } | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [query, setQuery] = useState("");
  const [bank, setBank] = useState<Bank | null>(null);
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<{ accountName: string; last4: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, b] = await Promise.all([getHome(), getBanks()]);
      setCurrent({ verified: h.vendor.bankVerified, bankName: h.vendor.bankName });
      setBanks(b);
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!loaded) return <Loading />;

  const filtered = query.trim()
    ? banks.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  async function submit() {
    if (!bank) return setError("Choose your bank.");
    if (!/^\d{10}$/.test(account)) return setError("Enter your 10-digit account number.");
    setBusy(true); setError(null); setVerified(null);
    try {
      const res = await verifyBank(bank.code, bank.name, account);
      setVerified(res);
      Alert.alert("Bank verified", `Account name: ${res.accountName}`, [{ text: "Done", onPress: () => router.back() }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify account");
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
      {current?.verified && (
        <Card style={{ backgroundColor: colors.successSoft, borderColor: colors.successSoft }}>
          <Row gap={space.sm}>
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
            <View>
              <Txt variant="bodyStrong" color={colors.success}>Bank account verified</Txt>
              <Txt variant="small" color={colors.success}>{current.bankName}. You can update it below.</Txt>
            </View>
          </Row>
        </Card>
      )}

      <Card>
        <Field label="Search your bank" value={query} onChangeText={(v) => { setQuery(v); setBank(null); }} placeholder="e.g. GTBank, Access, Opay" autoCapitalize="words" />
        {bank ? (
          <Row justify="space-between" style={{ marginTop: space.sm }}>
            <Txt variant="bodyStrong">{bank.name}</Txt>
            <Pressable onPress={() => { setBank(null); setQuery(""); }}><Ionicons name="close-circle" size={20} color={colors.mutedLight} /></Pressable>
          </Row>
        ) : filtered.length > 0 ? (
          <View style={{ marginTop: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
            {filtered.map((b, i) => (
              <View key={b.code}>
                <Pressable onPress={() => { setBank(b); setQuery(b.name); }} style={({ pressed }) => [{ padding: space.md }, pressed && { backgroundColor: colors.bgAlt }]}>
                  <Txt variant="body">{b.name}</Txt>
                </Pressable>
                {i < filtered.length - 1 && <Divider />}
              </View>
            ))}
          </View>
        ) : null}

        <Field label="Account number" value={account} onChangeText={setAccount} keyboardType="number-pad" maxLength={10} placeholder="10 digits" />
      </Card>

      {verified && (
        <Card style={{ backgroundColor: colors.successSoft, borderColor: colors.successSoft }}>
          <Txt variant="bodyStrong" color={colors.success}>{verified.accountName}</Txt>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Verify & save account" loading={busy} onPress={submit} icon={<Ionicons name="shield-checkmark" size={18} color="#fff" />} />
      <Txt variant="tiny" color={colors.mutedLight} center>Your account is verified with your bank before we save it.</Txt>
    </ScrollView>
  );
}
