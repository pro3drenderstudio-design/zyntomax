import { Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, Txt, Button, Divider } from "../lib/ui";
import { colors, space } from "../lib/theme";

const SUPPORT_PHONE = "08038830882";

const FAQ = [
  { q: "How do I request a pickup?", a: "Tap “Request a pickup”, take a clear photo of your recyclables, optionally add the weight, and submit. We’ll schedule a collector." },
  { q: "How much will I earn?", a: "You’re paid per kilogram at the current rate for each material once your recyclables are weighed at collection." },
  { q: "When do I get paid?", a: "After a collector weighs your recyclables, your earnings are settled to your bank. You’ll get an SMS confirmation." },
  { q: "How do I set up my bank account?", a: "Go to Profile → Bank & KYC to add and verify your bank account so payments can reach you." },
  { q: "Can I cancel a pickup?", a: "Contact us on the number below and we’ll help you cancel or reschedule an open request." },
];

export default function HelpScreen() {
  return (
    <Screen>
      <Card>
        <Txt variant="h3">Need help?</Txt>
        <Txt variant="small" color={colors.muted} style={{ marginTop: 4, marginBottom: space.md }}>
          Our team is here for you. Reach us any time.
        </Txt>
        <Button title={`Call ${SUPPORT_PHONE}`} icon={<Ionicons name="call" size={18} color="#fff" />} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
      </Card>

      <Txt variant="h3">Frequently asked</Txt>
      {FAQ.map((f, i) => (
        <Card key={i}>
          <Txt variant="bodyStrong">{f.q}</Txt>
          <Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>{f.a}</Txt>
        </Card>
      ))}
    </Screen>
  );
}
