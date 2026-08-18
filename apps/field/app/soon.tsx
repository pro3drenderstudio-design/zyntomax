import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, EmptyState } from "../lib/ui";
import { colors } from "../lib/theme";

export default function SoonScreen() {
  return (
    <Screen>
      <Card>
        <EmptyState
          icon={<Ionicons name="construct-outline" size={32} color={colors.mutedLight} />}
          title="Coming to the app soon"
          subtitle="This module is being built for mobile. It's already available on the web dashboard in the meantime."
        />
      </Card>
    </Screen>
  );
}
