"use client";

import { useActionState } from "react";
import { Recycle } from "lucide-react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-on-primary">
            <Recycle size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Zyntomax</h1>
            <p className="text-xs text-muted">Operations Platform</p>
          </div>
        </div>

        <form
          action={formAction}
          className="rounded-card border border-border bg-surface p-6 shadow-sm"
        >
          <div className="mb-4">
            <label htmlFor="phone" className="mb-1 block text-sm font-medium">
              Phone number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="username"
              required
              placeholder="08012345678"
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
