import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getQueue, flushQueue, type QueueItem } from "../lib/queue";
import { Screen, Card, Txt, Row, Button, Badge, EmptyState } from "../lib/ui";
import { colors, space } from "../lib/theme";
import { relativeDate } from "../lib/format";

export default function OutboxScreen() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => { setItems(await getQueue()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function sync() {
    setBusy(true);
    const [synced, remaining] = await flushQueue();
    setMessage(synced > 0 ? `${synced} synced · ${remaining} remaining` : remaining > 0 ? "Nothing synced — check your connection." : "Outbox is empty.");
    await load(); setBusy(false);
  }

  return (
    <Screen>
      <Card style={{ backgroundColor: items.length > 0 ? colors.infoSoft : colors.successSoft, borderColor: "transparent" }}>
        <Row gap={space.sm}>
          <Ionicons name={items.length > 0 ? "cloud-upload" : "checkmark-circle"} size={20} color={items.length > 0 ? colors.info : colors.success} />
          <Txt variant="bodyStrong" color={items.length > 0 ? colors.info : colors.success}>
            {items.length > 0 ? `${items.length} record${items.length > 1 ? "s" : ""} waiting to sync` : "Everything is synced"}
          </Txt>
        </Row>
      </Card>

      <Button title="Sync now" loading={busy} onPress={sync} icon={<Ionicons name="sync" size={18} color="#fff" />} />
      {message && <Txt variant="small" color={colors.muted} center>{message}</Txt>}

      {items.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="cloud-done-outline" size={32} color={colors.mutedLight} />} title="Nothing pending" subtitle="Weigh-ins and registrations captured offline appear here until they sync." /></Card>
      ) : (
        items.map((item) => (
          <Card key={item.clientUuid}>
            <Row justify="space-between">
              <Txt variant="bodyStrong">{item.kind === "weighin" ? "Weigh-in" : "Vendor registration"}</Txt>
              {item.uploads?.photoUri || item.uploads?.signatureUri ? <Badge label="+ photo" status="PENDING" /> : null}
            </Row>
            <Txt variant="small" color={colors.muted}>{relativeDate(item.createdAt)}</Txt>
            <Txt variant="body" style={{ marginTop: 4 }}>
              {item.kind === "weighin" ? `${String(item.payload.weightKg)} kg` : `${String(item.payload.name)} · ${String(item.payload.phone)}`}
            </Txt>
            {item.lastError ? <Txt variant="small" color={colors.destructive} style={{ marginTop: 4 }}>Last error: {item.lastError}</Txt> : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
