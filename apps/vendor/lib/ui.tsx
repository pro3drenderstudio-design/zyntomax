import type { ReactNode } from "react";
import {
  Text, TextInput, Pressable, View, StyleSheet, ActivityIndicator,
  ScrollView, RefreshControl, type TextInputProps, type StyleProp, type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, space, radius, type as t, shadow, statusColor } from "./theme";
import { initials as toInitials } from "./format";

/* ---------- Typography ---------- */
type TextVariant = keyof typeof t;
export function Txt({
  children, variant = "body", color = colors.text, style, numberOfLines, center,
}: {
  children: ReactNode; variant?: TextVariant; color?: string;
  style?: object; numberOfLines?: number; center?: boolean;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[t[variant], { color }, center && { textAlign: "center" }, style]}>
      {children}
    </Text>
  );
}

/* ---------- Layout ---------- */
export function Screen({
  children, scroll = true, refreshing, onRefresh, padded = true,
}: {
  children: ReactNode; scroll?: boolean; refreshing?: boolean;
  onRefresh?: () => void; padded?: boolean;
}) {
  const inner = (
    <View style={[padded && { padding: space.lg, gap: space.lg }]}>{children}</View>
  );
  if (!scroll) return <SafeAreaView edges={["bottom"]} style={styles.screen}>{inner}</SafeAreaView>;
  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined
        }
      >
        {inner}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Row({ children, gap = space.sm, style, align = "center", justify }: {
  children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>;
  align?: ViewStyle["alignItems"]; justify?: ViewStyle["justifyContent"];
}) {
  return <View style={[{ flexDirection: "row", alignItems: align, gap }, justify && { justifyContent: justify }, style]}>{children}</View>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>{content}</Pressable>;
  return content;
}

/* ---------- Buttons ---------- */
export function Button({
  title, onPress, disabled, loading, variant = "primary", icon, full = true, small,
}: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "destructive"; icon?: ReactNode; full?: boolean; small?: boolean;
}) {
  const isPrimary = variant === "primary";
  const isDestructive = variant === "destructive";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.button, small && { paddingVertical: 10, minHeight: 40 },
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        isDestructive && { backgroundColor: colors.destructive },
        full && { alignSelf: "stretch" },
        (disabled || pressed) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary || isDestructive ? "#fff" : colors.accent} />
      ) : (
        <Row gap={space.sm} justify="center">
          {icon}
          <Text style={[styles.buttonText, (variant === "secondary" || variant === "ghost") && { color: colors.text }]}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

/* ---------- Form ---------- */
export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View>
      {label && <Label>{label}</Label>}
      <TextInput placeholderTextColor={colors.mutedLight} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={{ color: colors.destructive, ...t.small }} accessibilityRole="alert">{children}</Text>
    </View>
  );
}

/* ---------- Data display ---------- */
export function StatCard({ label, value, hint, tone = "default" }: {
  label: string; value: string; hint?: string; tone?: "default" | "accent";
}) {
  return (
    <View style={[styles.card, styles.stat, tone === "accent" && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
      <Text style={[t.tiny, { color: tone === "accent" ? "rgba(255,255,255,0.85)" : colors.muted, textTransform: "uppercase" }]}>{label}</Text>
      <Text style={[t.h1, { color: tone === "accent" ? "#fff" : colors.text, marginTop: 2 }]}>{value}</Text>
      {hint ? <Text style={[t.small, { color: tone === "accent" ? "rgba(255,255,255,0.85)" : colors.muted, marginTop: 2 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Badge({ label, status }: { label: string; status?: string }) {
  const c = statusColor(status ?? label);
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text style={{ color: c.fg, ...t.tiny }}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, uri, size = 44 }: { name: string; uri?: string | null; size?: number }) {
  if (uri) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Image } = require("react-native");
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bgAlt }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: size * 0.38 }}>{toInitials(name)}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

export function ListRow({ left, title, subtitle, right, onPress }: {
  left?: ReactNode; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void;
}) {
  const body = (
    <Row gap={space.md} style={{ paddingVertical: space.md }}>
      {left}
      <View style={{ flex: 1 }}>
        <Text style={t.bodyStrong} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[t.small, { color: colors.muted, marginTop: 1 }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </Row>
  );
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>{body}</Pressable>;
  return body;
}

export function EmptyState({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: space.xxl, gap: space.sm }}>
      {icon}
      <Text style={[t.h3, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[t.small, { color: colors.muted, textAlign: "center", maxWidth: 260 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row justify="space-between" style={{ marginBottom: space.xs }}>
      <Text style={t.h3}>{title}</Text>
      {action}
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, ...shadow.card },
  stat: { flex: 1, padding: space.md, gap: 0 },
  label: { ...t.smallStrong, color: colors.text, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 16,
    backgroundColor: colors.surface, color: colors.text, minHeight: 50,
  },
  errorBox: { backgroundColor: colors.destructiveSoft, borderRadius: radius.md, padding: space.md },
  button: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", minHeight: 50 },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  buttonGhost: { backgroundColor: "transparent" },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
