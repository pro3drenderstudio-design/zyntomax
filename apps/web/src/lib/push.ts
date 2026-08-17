/**
 * Send an Expo push notification. Best-effort — failures are swallowed so they
 * never block the business action that triggered them.
 */
export async function sendExpoPush(
  token: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!token || !token.startsWith("ExponentPushToken")) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: token, title, body, sound: "default", data: data ?? {} }),
    });
  } catch {
    // best-effort
  }
}
