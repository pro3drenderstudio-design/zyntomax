"use client";

import { useState, useRef } from "react";
import { Camera, Loader2, X } from "lucide-react";

/**
 * Image picker that uploads immediately and stores the returned URL in a
 * hidden input (so it posts with the surrounding form). On mobile, the
 * camera capture attribute lets staff/vendor photos be taken on the spot.
 */
export function ImageUpload({
  name,
  label = "Photo",
  initialUrl,
  shape = "square",
}: {
  name: string;
  label?: string;
  initialUrl?: string | null;
  shape?: "square" | "circle";
}) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      setUrl(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const radius = shape === "circle" ? "rounded-full" : "rounded-lg";

  return (
    <div>
      <input type="hidden" name={name} value={url ?? ""} />
      <div className="flex items-center gap-3">
        <div
          className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted-bg ${radius}`}
        >
          {busy ? (
            <Loader2 size={22} className="animate-spin text-muted" aria-hidden />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={label} className="h-full w-full object-cover" />
          ) : (
            <Camera size={22} className="text-muted" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:bg-muted-bg disabled:opacity-60"
          >
            {url ? "Change photo" : `Add ${label.toLowerCase()}`}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => setUrl(null)}
              className="inline-flex cursor-pointer items-center gap-1 text-xs text-destructive hover:underline"
            >
              <X size={12} /> Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="hidden"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
