import { useCallback, useState } from "react";
import { View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getExpenses, type ExpensesData } from "../lib/api";
import { Screen, Card, Txt, Row, Button, StatCard, EmptyState, Loading, Divider } from "../lib/ui";
import { colors, space } from "../lib/theme";
import { naira, shortDate } from "../lib/format";

export default function ExpensesScreen() {
  const router = useRouter();
  const [data, setData] = useState<ExpensesData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await getExpenses()); } catch { setData(null); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (data === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <StatCard label="Spent this month" value={naira(data.monthTotal)} tone="accent" />
      <Button title="Record an expense" icon={<Ionicons name="add-circle" size={18} color="#fff" />} onPress={() => router.push("/expense-new")} />

      {data.expenses.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="receipt-outline" size={32} color={colors.mutedLight} />} title="No expenses yet" subtitle="Record a spend to see it here and in the P&L." /></Card>
      ) : (
        <Card>
          {data.expenses.map((e, i) => (
            <View key={e.id}>
              {i > 0 && <Divider />}
              <Row justify="space-between" style={{ paddingVertical: space.sm }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Txt variant="body">{e.category}</Txt>
                  <Txt variant="tiny" color={colors.mutedLight}>{e.site} · {shortDate(e.incurredAt)}{e.description ? ` · ${e.description}` : ""}</Txt>
                </View>
                <Txt variant="bodyStrong">{naira(e.amount)}</Txt>
              </Row>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
