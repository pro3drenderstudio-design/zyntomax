import { useCallback, useState } from "react";
import { View, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getWallet, requestWithdrawal, type WalletData } from "../lib/api";
import { Screen, Card, Txt, Row, Button, Field, ErrorText, Loading } from "../lib/ui";
import { colors, space } from "../lib/theme";
import { naira } from "../lib/format";

export default function WithdrawScreen() {
  const router = useRouter();
  const [w, setW] = useState<WalletData | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => { try { setW(await getWallet()); } catch { /* keep */ } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!w) return <Loading />;

  async function submit() {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError("Enter a valid amount.");
    if (w && amt > w.available) return setError(`You can withdraw up to ${naira(w.available)}.`);
    if (w && amt < w.minWithdrawal) return setError(`Minimum withdrawal is ${naira(w.minWithdrawal)}.`);
    setBusy(true); setError(null);
    try {
      await requestWithdrawal(amt);
      Alert.alert("Withdrawal requested", "We’re processing your withdrawal. You’ll get an SMS when it’s paid.");
      router.replace("/(tabs)/wallet");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit withdrawal");
    } finally { setBusy(false); }
  }

  return (
    <Screen>
      <Card>
        <Txt variant="tiny" color={colors.muted}>AVAILABLE</Txt>
        <Txt variant="h1" color={colors.accent}>{naira(w.available)}</Txt>
        <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>
          To {w.bank.bankName} ••{w.bank.last4}{w.bank.accountName ? ` · ${w.bank.accountName}` : ""}
        </Txt>
      </Card>

      <Card>
        <Field label="Amount to withdraw (₦)" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder={`Min ${naira(w.minWithdrawal)}`} />
        <Row gap={space.sm} style={{ marginTop: space.sm }}>
          {[0.25, 0.5, 1].map((frac) => (
            <View key={frac} style={{ flex: 1 }}>
              <Button title={frac === 1 ? "All" : `${frac * 100}%`} variant="secondary" small onPress={() => setAmount(String(Math.floor(w.available * frac)))} />
            </View>
          ))}
        </Row>
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title="Confirm withdrawal" loading={busy} onPress={submit} icon={<Ionicons name="cash" size={18} color="#fff" />} />
      <Txt variant="tiny" color={colors.mutedLight} center>Withdrawals are reviewed and paid to your verified bank account.</Txt>
    </Screen>
  );
}
