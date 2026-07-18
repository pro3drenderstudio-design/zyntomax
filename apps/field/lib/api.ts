import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// In development, the API runs on the same machine as Metro — derive its
// address from the bundler host so a DHCP lease change never breaks the app.
// extra.apiUrl (app.json) overrides for production builds.
function resolveApiUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host && /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return `http://${host}:3100`;
    }
  }
  return configured ?? "http://localhost:3100";
}

const API_URL: string = resolveApiUrl();

export type MobileUser = {
  id: string;
  name: string;
  phone: string;
  staffId: string | null;
  staffNo: string | null;
  roles: string[];
};

export type Bootstrap = {
  sites: { id: string; name: string }[];
  localities: { id: string; name: string; siteId: string }[];
  materials: { id: string; name: string }[];
  vendors: { id: string; name: string; phone: string; localityId: string | null; siteId: string; lat: number | null; lng: number | null }[];
  banks: { name: string; code: string }[];
};

export type TripSummary = {
  id: string;
  date: string;
  status: string;
  locality: string | null;
  vehicle: string | null;
  weighInCount: number;
  totalKg: number;
  totalAmount: number;
};

export type Pickup = {
  id: string;
  estWeightKg: number;
  status: string;
  createdAt: string;
  vendor: {
    id: string;
    name: string;
    phone: string;
    lat: number | null;
    lng: number | null;
    address: string | null;
    locality: string | null;
  };
};

const TOKEN_KEY = "zyntomax.token";
const USER_KEY = "zyntomax.user";
const BOOTSTRAP_KEY = "zyntomax.bootstrap";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getStoredUser(): Promise<MobileUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as MobileUser) : null;
}

export async function login(phone: string, password: string): Promise<MobileUser> {
  const res = await fetch(`${API_URL}/api/mobile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Login failed");
  await AsyncStorage.setItem(TOKEN_KEY, body.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(body.user));
  return body.user as MobileUser;
}

export async function logout(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export async function getPickups(): Promise<Pickup[]> {
  const data = await api<{ pickups: Pickup[] }>("/api/mobile/pickups");
  return data.pickups;
}

/** Post the agent's GPS during a trip (best-effort; ignores failures). */
export async function postLocation(lat: number, lng: number, tripId?: string): Promise<void> {
  try {
    await api("/api/mobile/location", { method: "POST", json: { lat, lng, tripId } });
  } catch {
    // best-effort; a dropped ping is fine
  }
}

/** Master data, cached for offline use. Returns cache when the network is down. */
export async function loadBootstrap(refresh = false): Promise<Bootstrap | null> {
  if (!refresh) {
    const cached = await AsyncStorage.getItem(BOOTSTRAP_KEY);
    if (cached) return JSON.parse(cached) as Bootstrap;
  }
  try {
    const data = await api<Bootstrap>("/api/mobile/bootstrap");
    await AsyncStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(data));
    return data;
  } catch {
    const cached = await AsyncStorage.getItem(BOOTSTRAP_KEY);
    return cached ? (JSON.parse(cached) as Bootstrap) : null;
  }
}
