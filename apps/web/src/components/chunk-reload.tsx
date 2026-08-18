"use client";

import { useEffect } from "react";

/**
 * After a new deployment, a tab still running the previous build can request a
 * JS/CSS chunk whose hashed filename no longer exists — surfacing as a generic
 * "client-side exception" white screen, most often right when a navigation or
 * form-submit redirect pulls a fresh chunk. This listens for those specific
 * chunk-load failures and reloads once (guarded against loops) so the user
 * silently lands on the current build instead of a crash. Real, non-chunk
 * errors are ignored and still surface normally.
 */
export function ChunkReload() {
  useEffect(() => {
    const isChunkError = (message?: string, name?: string) =>
      name === "ChunkLoadError" ||
      /Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
        message ?? "",
      );

    function recover(reason: string) {
      const KEY = "zx_chunk_reload_at";
      const last = Number(sessionStorage.getItem(KEY) ?? "0");
      // If we reloaded very recently the chunk is genuinely missing, not stale —
      // stop, so we don't spin in a reload loop.
      if (Date.now() - last < 15000) return;
      sessionStorage.setItem(KEY, String(Date.now()));
      console.warn("Reloading after chunk-load failure:", reason);
      window.location.reload();
    }

    function onError(e: ErrorEvent) {
      const name = (e.error as { name?: string } | undefined)?.name;
      if (isChunkError(e.message, name)) recover(e.message);
    }
    function onRejection(e: PromiseRejectionEvent) {
      const r = e.reason as { name?: string; message?: string } | undefined;
      if (isChunkError(r?.message, r?.name)) recover(r?.message ?? "unhandledrejection");
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
