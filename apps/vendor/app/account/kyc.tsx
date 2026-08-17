import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, EmptyState } from "../../lib/ui";
import { colors } from "../../lib/theme";

export default function Placeholder() {
  return (
    <Screen>
      <Card>
        <EmptyState
          icon={<Ionicons name="construct-outline" size={32} color={colors.mutedLight} />}
          title="Coming in the next update"
          subtitle="We’re building this out. Check back after the next app update."
        />
      </Card>
    </Screen>
  );
}
