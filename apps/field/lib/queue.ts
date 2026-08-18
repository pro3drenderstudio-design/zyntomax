import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { api, uploadPhoto } from "./api";

/**
 * Offline outbox. Weigh-ins and vendor registrations queue locally and sync when
 * connectivity returns. Every item carries a clientUuid, and the server dedupes
 * on it, so retrying is always safe. Photos/signatures are captured as local
 * file URIs and uploaded at sync time (they can't upload while offline).
 */

export type PendingUploads = { photoUri?: string; signatureUri?: string };

export type QueueItem = {
  clientUuid: string;
  kind: "weighin" | "vendor";
  payload: Record<string, unknown>;
  uploads?: PendingUploads;
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

/** Upload any pending local images and merge their URLs into the payload. */
async function applyUploads(payload: Record<string, unknown>, uploads?: PendingUploads): Promise<Record<string, unknown>> {
  if (!uploads) return payload;
  const out = { ...payload };
  if (uploads.photoUri) out.photoUrl = await uploadPhoto(uploads.photoUri);
  if (uploads.signatureUri) out.signatureUrl = await uploadPhoto(uploads.signatureUri);
  return out;
}

const pathFor = (kind: QueueItem["kind"]) => (kind === "weighin" ? "/api/mobile/weighins" : "/api/mobile/vendors");

/** Push everything in the outbox. Returns [synced, remaining]. */
export async function flushQueue(): Promise<[number, number]> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return [0, (await getQueue()).length];

  const queue = await getQueue();
  const remaining: QueueItem[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      // Upload photos first; on success, bake the URLs in and drop the local
      // URIs so a later submit-failure retry never re-uploads.
      if (item.uploads) {
        item.payload = await applyUploads(item.payload, item.uploads);
        item.uploads = undefined;
      }
      await api(pathFor(item.kind), { method: "POST", json: item.payload });
      synced++;
    } catch (e) {
      remaining.push({ ...item, lastError: e instanceof Error ? e.message : "Sync failed" });
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
  uploads?: PendingUploads,
): Promise<"sent" | "queued"> {
  try {
    const finalPayload = await applyUploads(payload, uploads);
    await api(pathFor(kind), { method: "POST", json: finalPayload });
    return "sent";
  } catch (e) {
    // Genuine server validation errors (not network) should surface to the user.
    const msg = e instanceof Error ? e.message : "";
    const looksLikeNetwork = /Network request failed|Failed to fetch|timed out|Request failed \(5/i.test(msg);
    if (!looksLikeNetwork && msg) throw e;
    await enqueue({ clientUuid, kind, payload, uploads });
    return "queued";
  }
}
