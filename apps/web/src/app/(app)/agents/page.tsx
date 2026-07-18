import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { AgentsMap } from "./agents-map";

export const metadata = { title: "Live agent tracking" };

export default async function AgentsPage() {
  await requireRole(["OPERATIONS_MANAGER", "TEAM_LEAD"]);
  return (
    <div>
      <PageHeader
        title="Live agent tracking"
        subtitle="Field agents' live location during trips — green = fresh, amber = a few minutes old"
      />
      <AgentsMap />
    </div>
  );
}
