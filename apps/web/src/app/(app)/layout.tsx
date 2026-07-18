import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { HeaderBar } from "@/components/header-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const staff = await prisma.staffProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, photoUrl: true },
  });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar roles={session.roles.map((r) => r.role)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar
          name={session.name}
          role={session.roles[0]?.role ?? "STAFF"}
          photoUrl={staff?.photoUrl ?? null}
          staffId={staff?.id ?? null}
        />
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
