import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { getQueue, flushQueue, type QueueItem } from "../lib/queue";
import { Button, Card } from "../lib/ui";
import { colors } from "../lib/theme";

export default function OutboxScreen() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(await getQueue());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function sync() {
    setBusy(true);
    const [synced, remaining] = await flushQueue();
    setMessage(
      synced > 0
        ? `${synced} record${synced > 1 ? "s" : ""} synced. ${remaining} remaining.`
        : remaining > 0
          ? "Nothing synced — check your connection."
          : "Outbox is empty.",
    );
    await load();
    setBusy(false);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Button title={busy ? "Syncing…" : "Sync now"} onPress={sync} disabled={busy} />
      {message && (
        <Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>{message}</Text>
      )}
      <View style={{ height: 16 }} />
      {items.length === 0 ? (
        <Card>
          <Text style={{ color: colors.muted, textAlign: "center", paddingVertical: 12 }}>
            No pending records — everything is on the server.
          </Text>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.clientUuid} style={{ marginBottom: 8 }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>
              {item.kind === "weighin" ? "Weigh-in" : "Vendor registration"}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {new Date(item.createdAt).toLocaleString("en-NG")}
            </Text>
            {item.kind === "weighin" && (
              <Text style={{ color: colors.text, marginTop: 4 }}>
                {String(item.payload.weightKg)} kg
              </Text>
            )}
            {item.kind === "vendor" && (
              <Text style={{ color: colors.text, marginTop: 4 }}>
                {String(item.payload.name)} · {String(item.payload.phone)}
              </Text>
            )}
            {item.lastError && (
              <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 4 }}>
                Last error: {item.lastError}
              </Text>
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
