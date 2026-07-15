import { prisma } from "@zyntomax/db";

/**
 * SMS via Termii. Without an API key, messages are logged as PENDING
 * notifications so the flow is visible in development.
 */
export async function sendSms(params: {
  to: string;
  body: string;
  vendorId?: string;
  userId?: string;
}) {
  const apiKey = process.env.TERMII_API_KEY;

  const notification = await prisma.notification.create({
    data: {
      vendorId: params.vendorId,
      userId: params.userId,
      channel: "SMS",
      title: "SMS",
      body: params.body,
      status: "PENDING",
    },
  });

  if (!apiKey) return; // dev: recorded only

  try {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: params.to,
        from: process.env.TERMII_SENDER_ID ?? "Zyntomax",
        sms: params.body,
        type: "plain",
        channel: "generic",
      }),
    });
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: res.ok ? "SENT" : "FAILED" },
    });
  } catch {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED" },
    });
  }
}
