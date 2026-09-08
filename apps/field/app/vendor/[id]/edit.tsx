import { useEffect, useState } from "react";
import { View, Pressable, Alert, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getVendor, updateVendor, loadBootstrap, type Bootstrap } from "../../../lib/api";
import { Card, Txt, Button, Field, ErrorText, Loading } from "../../../lib/ui";
import { colors, space, radius } from "../../../lib/theme";

export default function VendorEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [localityId, setLocalityId] = useState<string | null>(null);
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBootstrap().then(setBoot);
    getVendor(id).then((v) => {
      setName(v.name); setNickname(v.nickname ?? ""); setPhone(v.phone);
      setAddress(v.address ?? ""); setLocalityId(v.localityId);
      setBankAccountNo(v.bankAccountNo ?? ""); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [id]);

  if (!loaded || !boot) return <Loading />;

  async function submit() {
    if (name.trim().length < 2) return setError("Enter the vendor's name.");
    if (!/^0\d{10}$/.test(phone.trim())) return setError("Enter an 11-digit phone number.");
    setBusy(true); setError(null);
    const bank = boot!.banks.find((b) => b.code === bankCode);
    try {
      await updateVendor(id, {
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        phone: phone.trim(),
        address: address.trim() || undefined,
        localityId,
        bankCode: bankCode ?? undefined,
        bankName: bank?.name ?? undefined,
        bankAccountNo: bankAccountNo.trim() || undefined,
      });
      Alert.alert("Saved", "Vendor details updated.");
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <Field label="Full name" value={name} onChangeText={setName} />
        <Field label="Nickname (optional)" value={nickname} onChangeText={setNickname} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={11} />
        <Field label="Address" value={address} onChangeText={setAddress} />
      </Card>

      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 8 }}>Locality</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {boot.localities.map((l) => {
            const active = localityId === l.id;
            return (
              <Pressable key={l.id} onPress={() => setLocalityId(active ? null : l.id)} style={{ borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Txt variant="small" color={active ? colors.accentDark : colors.text}>{l.name}</Txt>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Txt variant="smallStrong" style={{ marginBottom: 8 }}>Bank (for payouts)</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.sm }}>
          {boot.banks.slice(0, 16).map((b) => {
            const active = bankCode === b.code;
            return (
              <Pressable key={b.code} onPress={() => setBankCode(active ? null : b.code)} style={{ borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Txt variant="tiny" color={active ? colors.accentDark : colors.text}>{b.name}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Field label="Account number" value={bankAccountNo} onChangeText={setBankAccountNo} keyboardType="number-pad" maxLength={10} placeholder="10-digit NUBAN" />
        <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: 4 }}>Changing the account re-verifies it with Paystack on save.</Txt>
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title="Save changes" loading={busy} onPress={submit} icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
