import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { registerPushToken } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

/** Ask for notification permission and register the Expo push token (best-effort). */
export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    if (token) await registerPushToken(token);
  } catch {
    // best-effort — push simply won't work if unconfigured
  }
}
