import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:3100";

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
  vendors: { id: string; name: string; phone: string; localityId: string | null; siteId: string }[];
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
