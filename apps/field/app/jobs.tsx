import { useCallback, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getJobs, type JobSummary } from "../lib/api";
import { Screen, Card, Txt, Row, Badge, Button, EmptyState, Loading } from "../lib/ui";
import { colors } from "../lib/theme";
import { kg, relativeDate } from "../lib/format";

export default function JobsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setJobs((await getJobs()).jobs); } catch { setJobs([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (jobs === null) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Button title="Scale in a new job" icon={<Ionicons name="add-circle" size={18} color="#fff" />} onPress={() => router.push("/job-new")} />

      {jobs.length === 0 ? (
        <Card><EmptyState icon={<Ionicons name="hammer-outline" size={32} color={colors.mutedLight} />} title="No open jobs" subtitle="Scale in material at a stage to start a job, or wait for one to be assigned to you." /></Card>
      ) : (
        jobs.map((j) => (
          <Card key={j.id} onPress={() => router.push(`/job/${j.id}` as never)}>
            <Row justify="space-between">
              <Txt variant="bodyStrong">{j.stage}</Txt>
              <Badge label={j.status} status={j.status} />
            </Row>
            <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>
              {j.inputMaterial} · {kg(j.weightInKg)} in{j.weightOutKg != null ? ` · ${kg(j.weightOutKg)} out` : ""}
            </Txt>
            {j.flagReason ? <Txt variant="small" color={colors.destructive} style={{ marginTop: 2 }}>{j.flagReason}</Txt> : null}
            <Txt variant="tiny" color={colors.mutedLight} style={{ marginTop: 4 }}>{j.assignees.join(", ")} · {relativeDate(j.startedAt)}</Txt>
          </Card>
        ))
      )}
    </Screen>
  );
}
