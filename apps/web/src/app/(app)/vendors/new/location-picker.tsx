"use client";

import { useState } from "react";
import { LocateFixed } from "lucide-react";

export function LocationPicker({
  initialLat,
  initialLng,
}: {
  initialLat?: number;
  initialLng?: number;
} = {}) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null
      ? { lat: initialLat, lng: initialLng }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pin() {
    if (!navigator.geolocation) {
      setError("This device does not support location.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setBusy(false);
      },
      () => {
        setError("Could not get location. Allow location access and try again.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div>
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />
      <button
        type="button"
        onClick={pin}
        disabled={busy}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted-bg px-3 py-2.5 text-sm font-medium transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-60"
      >
        <LocateFixed size={16} aria-hidden />
        {busy
          ? "Getting location…"
          : coords
            ? `Pinned: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} (tap to re-pin)`
            : "Pin current location"}
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {coords && (
        <p className="mt-1 text-xs text-accent">
          Location captured — register while standing at the vendor&apos;s house.
        </p>
      )}
    </div>
  );
}
