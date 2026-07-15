import { requireSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { logout } from "./actions";
import { LogOut } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar roles={session.roles.map((r) => r.role)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-end gap-3 border-b border-border bg-surface px-6 py-2.5 lg:flex">
          <span className="text-sm text-muted">{session.name}</span>
          <form action={logout}>
            <button
              type="submit"
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-muted-bg hover:text-foreground"
            >
              <LogOut size={15} aria-hidden />
              Sign out
            </button>
          </form>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
