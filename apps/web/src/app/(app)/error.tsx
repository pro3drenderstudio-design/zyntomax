"use client";

import { useEffect } from "react";

/**
 * Admin-area error boundary. A transient database connection-pool timeout
 * (Prisma P2024) under a burst of traffic would otherwise white-screen the
 * whole page; here we catch it and offer an immediate retry, which usually
 * succeeds once a connection frees up. Persistent errors still surface.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the digest in the browser console for support/debugging.
    console.error("Admin page error", error.digest, error.message);
  }, [error]);

  const isTransient = /connection pool|P2024|Timed out fetching/i.test(error.message);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted-bg text-2xl">
        {isTransient ? "⏳" : "⚠️"}
      </div>
      <div>
        <h1 className="text-lg font-bold text-fg">
          {isTransient ? "The system is busy" : "Something went wrong"}
        </h1>
        <p className="mt-1 max-w-md text-sm text-muted">
          {isTransient
            ? "The database was momentarily overloaded. This is usually a quick blip — try again."
            : "We hit an unexpected error loading this page. Try again, and if it keeps happening let support know."}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:opacity-90"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-xl border border-border px-5 py-2.5 font-semibold text-fg no-underline hover:bg-muted-bg"
        >
          Back to dashboard
        </a>
      </div>
      {error.digest && (
        <p className="text-xs text-muted">Reference: {error.digest}</p>
      )}
    </div>
  );
}
