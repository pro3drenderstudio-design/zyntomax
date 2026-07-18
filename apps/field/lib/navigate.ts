import { Linking, Platform } from "react-native";

/**
 * Open turn-by-turn navigation to a vendor's pinned location in the phone's
 * maps app (Google Maps / Apple Maps) — the "uber-like" pickup guide.
 */
export function navigateTo(lat: number, lng: number, label?: string) {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${q}`
      : `google.navigation:q=${lat},${lng}`;
  Linking.openURL(url).catch(() => {
    // Fallback to the universal Google Maps directions URL
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
  });
}
