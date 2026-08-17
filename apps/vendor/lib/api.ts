import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

function resolveApiUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host && /^\d+\.\d+\.\d+\.\d+$/.test(host)) return `http://${host}:3100`;
  }
  return configured ?? "http://localhost:3100";
}
const API_URL = resolveApiUrl();

const TOKEN_KEY = "zyntomax.vendor.token";
const VENDOR_KEY = "zyntomax.vendor.profile";

export type VendorProfile = { id: string; name: string; vendorNo: string | null; phone: string };

export type VendorHome = {
  vendor: { id: string; name: string; nickname: string | null; vendorNo: string | null; phone: string; locality: string | null; bankVerified: boolean; bankName: string | null };
  lifetimeKg: number;
  lifetimeNaira: number;
  rewards: {
    tiers: { name: string; thresholdKg: number; reward: string; earned: boolean }[];
    next: { name: string; thresholdKg: number; reward: string; remainingKg: number } | null;
  };
  collections: { id: string; date: string; material: string; weightKg: number; amount: number }[];
  payments: { id: string; date: string; amount: number; status: string; reference: string | null }[];
};

export type VendorPickup = {
  id: string;
  estWeightKg: number | null;
  photoUrl: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  trip: { id: string; date: string; status: string; vehicle: string | null; collector: string | null } | null;
};

export async function getToken() { return AsyncStorage.getItem(TOKEN_KEY); }
export async function getStoredVendor(): Promise<VendorProfile | null> {
  const raw = await AsyncStorage.getItem(VENDOR_KEY);
  return raw ? JSON.parse(raw) : null;
}
export async function logout() { await AsyncStorage.multiRemove([TOKEN_KEY, VENDOR_KEY]); }

async function post<T>(path: string, json: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

async function auth<T>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

export async function requestOtp(phone: string): Promise<{ devCode?: string }> {
  return post<{ ok: boolean; devCode?: string }>("/api/vendor/otp/request", { phone });
}

export async function verifyOtp(phone: string, code: string): Promise<VendorProfile> {
  const body = await post<{ token: string; vendor: VendorProfile }>("/api/vendor/otp/verify", { phone, code });
  await AsyncStorage.setItem(TOKEN_KEY, body.token);
  await AsyncStorage.setItem(VENDOR_KEY, JSON.stringify(body.vendor));
  return body.vendor;
}

export async function getHome(): Promise<VendorHome> { return auth<VendorHome>("/api/vendor/me"); }
export async function getPickups(): Promise<VendorPickup[]> {
  const b = await auth<{ pickups: VendorPickup[] }>("/api/vendor/pickups");
  return b.pickups;
}

/** Upload a local image file (from camera/gallery) and return its public URL. */
export async function uploadPhoto(uri: string): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  const name = uri.split("/").pop() || `photo-${Date.now()}.jpg`;
  // React Native's fetch accepts a {uri,name,type} file object in FormData.
  form.append("file", { uri, name, type: "image/jpeg" } as unknown as Blob);
  const res = await fetch(`${API_URL}/api/vendor/upload`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Upload failed");
  return body.url as string;
}

export async function requestPickup(input: {
  photoUrl: string; estWeightKg?: number; note?: string; lat?: number; lng?: number;
}): Promise<void> {
  await auth("/api/vendor/pickups", { method: "POST", json: input });
}
