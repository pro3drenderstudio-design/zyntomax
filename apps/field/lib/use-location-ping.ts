import { useEffect } from "react";
import * as Location from "expo-location";
import { postLocation } from "./api";

/**
 * While mounted (i.e. the agent is on a trip screen), post GPS every ~30s so
 * the admin can see live agent positions during collection.
 */
export function useLocationPing(tripId?: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function ping() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) await postLocation(pos.coords.latitude, pos.coords.longitude, tripId);
      } catch {
        // best-effort
      }
    }

    ping();
    const id = setInterval(ping, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [tripId, enabled]);
}
