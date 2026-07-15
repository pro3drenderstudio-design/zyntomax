import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";

/**
 * Offline outbox. Weigh-ins and vendor registrations queue locally and sync
 * when connectivity returns. Every item carries a clientUuid, and the server
 * dedupes on it, so retrying is always safe.
 */

export type QueueItem = {
  clientUuid: string;
  kind: "weighin" | "vendor";
  payload: Record<string, unknown>;
  createdAt: string;
  lastError?: string;
};

const QUEUE_KEY = "zyntomax.outbox";

export async function getQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueueItem[]) : [];
}

async function saveQueue(items: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueue(item: Omit<QueueItem, "createdAt">): Promise<void> {
  const queue = await getQueue();
  queue.push({ ...item, createdAt: new Date().toISOString() });
  await saveQueue(queue);
}

/** Push everything in the outbox. Returns [synced, remaining]. */
export async function flushQueue(): Promise<[number, number]> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    const q = await getQueue();
    return [0, q.length];
  }

  const queue = await getQueue();
  const remaining: QueueItem[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      if (item.kind === "weighin") {
        await api("/api/mobile/weighins", { method: "POST", json: item.payload });
      } else {
        await api("/api/mobile/vendors", { method: "POST", json: item.payload });
      }
      synced++;
    } catch (e) {
      // 4xx validation errors won't succeed on retry either, but keeping them
      // visible in the outbox beats losing field data silently.
      remaining.push({
        ...item,
        lastError: e instanceof Error ? e.message : "Sync failed",
      });
    }
  }

  await saveQueue(remaining);
  return [synced, remaining.length];
}

/** Try to submit now; fall back to the outbox when offline or the server is unreachable. */
export async function submitOrQueue(
  kind: QueueItem["kind"],
  clientUuid: string,
  payload: Record<string, unknown>,
): Promise<"sent" | "queued"> {
  try {
    const path = kind === "weighin" ? "/api/mobile/weighins" : "/api/mobile/vendors";
    await api(path, { method: "POST", json: payload });
    return "sent";
  } catch (e) {
    // Server-side validation errors (thrown with a message) are re-thrown so
    // the user can fix the form; network failures get queued.
    if (e instanceof Error && !/network|fetch|failed \(5/i.test(e.message)) {
      const looksLikeNetwork = /Network request failed|Failed to fetch/i.test(e.message);
      if (!looksLikeNetwork) throw e;
    }
    await enqueue({ clientUuid, kind, payload });
    return "queued";
  }
}
