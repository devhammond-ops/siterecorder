import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReportSchedule, ReportRun } from "@/lib/types";
import { SchedulesManager } from "@/components/schedules-manager";

export default async function SchedulesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: schedules }, { data: runs }] = await Promise.all([
    supabase.from("report_schedules").select("*").order("created_at", { ascending: false }),
    supabase.from("report_runs").select("*").order("ran_at", { ascending: false }).limit(20),
  ]);

  return (
    <SchedulesManager
      schedules={(schedules ?? []) as ReportSchedule[]}
      runs={(runs ?? []) as ReportRun[]}
    />
  );
}
