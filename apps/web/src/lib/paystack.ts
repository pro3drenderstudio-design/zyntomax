/**
 * Paystack client. When PAYSTACK_SECRET_KEY is a placeholder (sk_test_placeholder),
 * calls are simulated so the full payout flow can be exercised in development.
 */

const BASE = "https://api.paystack.co";

function key() {
  return process.env.PAYSTACK_SECRET_KEY ?? "";
}

export function isSimulated() {
  return !key() || key().includes("placeholder");
}

async function ps<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !body.status) {
    throw new Error(`Paystack: ${body.message ?? res.statusText}`);
  }
  return body.data;
}

export async function resolveAccount(accountNumber: string, bankCode: string) {
  if (isSimulated()) {
    return { account_number: accountNumber, account_name: "SIMULATED ACCOUNT" };
  }
  return ps<{ account_number: string; account_name: string }>(
    `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
  );
}

export async function createTransferRecipient(params: {
  name: string;
  accountNumber: string;
  bankCode: string;
}) {
  if (isSimulated()) {
    return { recipient_code: `RCP_sim_${Date.now()}` };
  }
  const data = await ps<{ recipient_code: string }>(`/transferrecipient`, {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: "NGN",
    }),
  });
  return data;
}

export async function initiateTransfer(params: {
  amountNaira: number;
  recipientCode: string;
  reference: string; // idempotency key — Paystack dedupes on this
  reason: string;
}) {
  if (isSimulated()) {
    return {
      transfer_code: `TRF_sim_${params.reference}`,
      status: "success" as string,
      reference: params.reference,
    };
  }
  return ps<{ transfer_code: string; status: string; reference: string }>(
    `/transfer`,
    {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(params.amountNaira * 100), // kobo
        recipient: params.recipientCode,
        reference: params.reference,
        reason: params.reason,
      }),
    },
  );
}

export async function paystackBalance(): Promise<number> {
  if (isSimulated()) return -1; // caller falls back to internal ledger
  const data = await ps<{ currency: string; balance: number }[]>(`/balance`);
  const ngn = data.find((b) => b.currency === "NGN");
  return ngn ? ngn.balance / 100 : 0;
}

export const NIGERIAN_BANKS: { name: string; code: string }[] = [
  { name: "Access Bank", code: "044" },
  { name: "Citibank", code: "023" },
  { name: "Ecobank", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank", code: "011" },
  { name: "FCMB", code: "214" },
  { name: "GTBank", code: "058" },
  { name: "Heritage Bank", code: "030" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "Opay", code: "999992" },
  { name: "Palmpay", code: "999991" },
  { name: "Polaris Bank", code: "076" },
  { name: "Providus Bank", code: "101" },
  { name: "Stanbic IBTC", code: "221" },
  { name: "Standard Chartered", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "UBA", code: "033" },
  { name: "Union Bank", code: "032" },
  { name: "Unity Bank", code: "215" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];
