import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
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
  estWeightKg: number | null;
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
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return AsyncStorage.getItem(TOKEN_KEY); }
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
  await SecureStore.setItemAsync(TOKEN_KEY, body.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(body.user));
  return body.user as MobileUser;
}

export async function logout(): Promise<void> {
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* ignore */ }
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, BOOTSTRAP_KEY]);
}

/**
 * Re-fetch the current user's roles and rotate the token, so role changes and
 * account suspension take effect without a manual re-login. Returns the fresh
 * user, or null when the account is no longer valid (caller should sign out).
 * On a network blip it keeps the cached session rather than logging out.
 */
export async function refreshSession(): Promise<MobileUser | null> {
  try {
    const data = await api<{ token: string; user: MobileUser }>("/api/mobile/me");
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // Genuine auth failure (bad/expired token, suspended account) → sign out.
    if (/Unauthorized|Account inactive/i.test(msg)) {
      await logout();
      return null;
    }
    // Network or transient error → keep whatever we have cached.
    return getStoredUser();
  }
}

/** Upload a local image (weigh-in photo, scale reading) and return its public URL. */
export async function uploadPhoto(uri: string): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  const name = uri.split("/").pop() || `photo-${Date.now()}.jpg`;
  form.append("file", { uri, name, type: "image/jpeg" } as unknown as Blob);
  const res = await fetch(`${API_URL}/api/mobile/upload`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Upload failed");
  return body.url as string;
}

export async function registerPushToken(token: string): Promise<void> {
  try { await api("/api/mobile/push-token", { method: "POST", json: { token } }); } catch { /* best-effort */ }
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

export type AdminDashboard = {
  kpis: {
    activeVendors: number;
    collectedTodayKg: number;
    collectedTodayNaira: number;
    intakeKg: number;
    wipKg: number;
    finishedKg: number;
    walletBalance: number;
    flaggedJobs: number;
    activeTrips: number;
  };
  approvals: {
    reconciledTrips: { id: string; locality: string; date: string; payout: number; vendors: number }[];
    readyBatches: { id: string; locality: string; total: number; vendors: number; status: string }[];
  };
};

export async function getAdminDashboard(): Promise<AdminDashboard> {
  return api<AdminDashboard>("/api/mobile/admin/dashboard");
}

export async function approveTrip(tripId: string): Promise<void> {
  await api("/api/mobile/admin/approve-trip", { method: "POST", json: { tripId } });
}

export async function getPickups(): Promise<Pickup[]> {
  const data = await api<{ pickups: Pickup[] }>("/api/mobile/pickups");
  return data.pickups;
}

/* ── Production jobs ─────────────────────────────────────────────── */
export type JobSummary = {
  id: string; stage: string; inputMaterial: string; weightInKg: number;
  weightOutKg: number | null; status: string; flagReason: string | null; startedAt: string; assignees: string[];
};
export type JobDetail = JobSummary & {
  wasteKg: number | null; tolerancePct: number; scaleInPhotoUrl: string | null; scaleOutPhotoUrl: string | null;
  outputs: { materialId: string; name: string; kind: string }[];
  recorded: { materialId: string; name: string; weightKg: number }[];
};
export type ProductionSetup = {
  siteId: string;
  stages: { id: string; name: string }[];
  inputs: { materialId: string; name: string; kind: string; availableKg: number; stageIds: string[] }[];
  outputsByKey: Record<string, { materialId: string; name: string; kind: string }[]>;
};

export async function getJobs(): Promise<{ isSupervisor: boolean; jobs: JobSummary[] }> {
  return api("/api/mobile/jobs");
}
export async function getJob(id: string): Promise<JobDetail> {
  return api(`/api/mobile/jobs/${id}`);
}
export async function scaleOutJob(id: string, input: { outputs: { outputMaterialTypeId: string; weightKg: number }[]; wasteKg: number; scaleOutPhotoUrl?: string }): Promise<{ status: string }> {
  return api(`/api/mobile/jobs/${id}/complete`, { method: "POST", json: input });
}
export async function getProductionSetup(siteId?: string): Promise<ProductionSetup> {
  return api(`/api/mobile/production/setup${siteId ? `?siteId=${siteId}` : ""}`);
}
export async function scaleInJob(input: { siteId: string; stageId: string; materialTypeId: string; weightInKg: number; scaleInPhotoUrl?: string }): Promise<{ id: string }> {
  return api("/api/mobile/jobs", { method: "POST", json: input });
}

/* ── Finance ─────────────────────────────────────────────────────── */
export type WithdrawalRow = {
  id: string; vendor: string; phone: string; amount: number; status: string;
  bankName: string | null; accountLast4: string | null; failureReason: string | null; requestedAt: string;
};
export type WithdrawalQueue = { float: number; pendingCount: number; pendingTotal: number; paidTotal: number; withdrawals: WithdrawalRow[] };

export async function getWithdrawals(): Promise<WithdrawalQueue> {
  return api("/api/mobile/withdrawals");
}
export async function approveWithdrawal(id: string): Promise<{ status: string }> {
  return api(`/api/mobile/withdrawals/${id}/approve`, { method: "POST" });
}
export async function rejectWithdrawal(id: string): Promise<{ ok: boolean }> {
  return api(`/api/mobile/withdrawals/${id}/reject`, { method: "POST" });
}

export type ExpenseRow = { id: string; amount: number; category: string; site: string; description: string | null; incurredAt: string };
export type ExpensesData = {
  monthTotal: number;
  categories: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  expenses: ExpenseRow[];
};

export async function getExpenses(): Promise<ExpensesData> {
  return api("/api/mobile/expenses");
}
export async function createExpense(input: { siteId: string; categoryId: string; amount: number; description?: string; receiptUrl?: string }): Promise<{ id: string }> {
  return api("/api/mobile/expenses", { method: "POST", json: input });
}

export type Pnl = {
  period: string; revenue: number; vendorCost: number; purchaseCost: number; directExpenses: number;
  wages: number; opex: number; cogs: number; grossProfit: number; netProfit: number; outputKg: number;
};
export async function getReport(month?: string): Promise<Pnl> {
  return api(`/api/mobile/reports${month ? `?month=${month}` : ""}`);
}

/* ── People / payroll ────────────────────────────────────────────── */
export type StaffRow = { id: string; staffNo: string; name: string; phone: string; title: string | null; wageModel: string; status: string; roles: string[] };
export type PayslipRow = { id: string; weekStart: string; earnedAmount: number; advanceDeduction: number; discrepancyDeduction: number; netAmount: number; paid: boolean };
export type StaffDetail = {
  id: string; staffNo: string; name: string; phone: string; title: string | null;
  wageModel: string; baseSalaryWeekly: number | null; status: string; hireDate: string | null;
  roles: string[]; outstandingAdvance: number; totalEarned: number; payslips: PayslipRow[];
};

export async function getStaff(): Promise<{ staff: StaffRow[] }> {
  return api("/api/mobile/staff");
}
export async function getStaffMember(id: string): Promise<StaffDetail> {
  return api(`/api/mobile/staff/${id}`);
}
export async function setStaffStatus(id: string, status: "ACTIVE" | "SUSPENDED" | "EXITED"): Promise<{ status: string }> {
  return api(`/api/mobile/staff/${id}/status`, { method: "POST", json: { status } });
}

export type PayrollRunRow = { id: string; site: string; weekStart: string; weekEnd: string; status: string; staffCount: number; unpaidCount: number; netTotal: number };
export type PayrollData = { sites: { id: string; name: string }[]; runs: PayrollRunRow[] };
export type PayrollItemRow = {
  id: string; staff: string; staffNo: string; commissionAmount: number; baseAmount: number;
  advanceDeduction: number; discrepancyDeduction: number; netAmount: number; paid: boolean; paymentRef: string | null;
};
export type PayrollRunDetail = { id: string; site: string; weekStart: string; weekEnd: string; status: string; canPay: boolean; netTotal: number; items: PayrollItemRow[] };

export async function getPayroll(): Promise<PayrollData> {
  return api("/api/mobile/payroll");
}
export async function openPayroll(siteId: string): Promise<{ staff: number }> {
  return api("/api/mobile/payroll", { method: "POST", json: { siteId } });
}
export async function getPayrollRun(id: string): Promise<PayrollRunDetail> {
  return api(`/api/mobile/payroll/${id}`);
}
export async function payPayrollItem(itemId: string, paymentRef?: string): Promise<{ ok: boolean }> {
  return api(`/api/mobile/payroll/items/${itemId}/pay`, { method: "POST", json: { paymentRef } });
}

export type MyEarnings = {
  staffNo: string; title: string | null; wageModel: string;
  commissionAmount: number; baseAmount: number; earnedAmount: number; jobCount: number;
  jobs: { id: string; stage: string; material: string; basisKg: number; wage: number; completedAt: string | null }[];
  outstandingAdvance: number; payslips: PayslipRow[];
};
export async function getMyEarnings(): Promise<MyEarnings> {
  return api("/api/mobile/me/earnings");
}

/* ── Inventory ───────────────────────────────────────────────────── */
export type MaterialStock = { materialId: string; name: string; kind: string; color: string | null; kg: number };
export type StageStock = { stageId: string; stageName: string; materials: MaterialStock[] };
export type Inventory = {
  totals: { raw: number; waiting: number; active: number; finished: number };
  raw: MaterialStock[]; waiting: MaterialStock[]; active: StageStock[]; finished: MaterialStock[];
};
export type Movement = { createdAt: string; weightKg: number; from: string | null; to: string | null; by: string | null; note: string | null; refType: string };
export type MaterialDetail = { material: { id: string; name: string; kind: string; color: string | null }; availableKg: number; movements: Movement[] };

export async function getInventory(): Promise<Inventory> {
  return api("/api/mobile/inventory");
}
export async function getMaterial(id: string): Promise<MaterialDetail> {
  return api(`/api/mobile/inventory/${id}`);
}

/* ── Sales (read-only) ───────────────────────────────────────────── */
export type SaleRow = {
  id: string; orderNo: string; customer: string; status: string; itemNames: string[]; itemCount: number;
  total: number; paid: number; outstanding: number; invoiceNo: string | null; invoiceStatus: string; createdAt: string;
};
export type SalesData = { aging: { current: number; d1_30: number; d31_60: number; d60plus: number }; outstandingTotal: number; orders: SaleRow[] };
export type SaleDetail = {
  id: string; orderNo: string; customer: { name: string; phone: string | null; contactName: string | null };
  status: string; driverName: string | null; truckNo: string | null; waybillNo: string | null; createdAt: string; total: number;
  lines: { name: string; isInventory: boolean; qtyKg: number; unitPrice: number; lineTotal: number }[];
  invoice: { invoiceNo: string; amount: number; paid: number; outstanding: number; dueDate: string; status: string; payments: { amount: number; method: string; reference: string | null; paidAt: string }[] } | null;
};

export async function getSales(): Promise<SalesData> {
  return api("/api/mobile/sales");
}
export async function getSale(id: string): Promise<SaleDetail> {
  return api(`/api/mobile/sales/${id}`);
}

/* ── Purchases (read-only) ───────────────────────────────────────── */
export type PurchaseRow = { id: string; lotNo: string; supplier: string; scaledIn: boolean; kg: number; materialCost: number; landed: number | null; status: string; createdAt: string };
export type PurchaseDetail = {
  id: string; lotNo: string; supplier: { name: string; phone: string | null }; scaledIn: boolean; scaledInAt: string | null;
  fieldEstKg: number | null; kg: number; variancePct: number | null; materialCost: number; expenseCost: number; landed: number | null;
  covered: number; outstanding: number; status: string;
  items: { name: string; weightKg: number; pricePerKg: number; amount: number }[];
  expenses: { category: string; description: string | null; amount: number; incurredAt: string }[];
};

export async function getPurchases(): Promise<{ batches: PurchaseRow[] }> {
  return api("/api/mobile/purchases");
}
export async function getPurchase(id: string): Promise<PurchaseDetail> {
  return api(`/api/mobile/purchases/${id}`);
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
