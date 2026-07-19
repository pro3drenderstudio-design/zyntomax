"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Zyntomax Ventures Limited" className="h-16 w-16 object-contain" />
          <p className="mt-3 text-2xl font-bold tracking-tight">Zyntomax</p>
          <p className="text-sm font-medium text-muted">Operations Platform</p>
        </div>

        <form
          action={formAction}
          className="rounded-card border border-border bg-surface p-6 shadow-sm"
        >
          <div className="mb-4">
            <label htmlFor="identifier" className="mb-1 block text-sm font-medium">
              Email or phone
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              required
              placeholder="you@zyntomax.com or 08012345678"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {state.error && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full cursor-pointer rounded-md bg-accent px-4 py-2.5 font-medium text-on-primary transition-colors duration-200 hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
