import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCK_KEY = "zyntomax.vendor.lock";

export async function isLockEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(LOCK_KEY)) === "1";
}
export async function setLockEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(LOCK_KEY, on ? "1" : "0");
}
export async function biometricsAvailable(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}
export async function authenticate(): Promise<boolean> {
  if (!(await biometricsAvailable())) return true; // no biometrics enrolled → don't lock the user out
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Zyntomax", fallbackLabel: "Use passcode" });
  return res.success;
}
