import { createClient } from "@/lib/supabase/server";
import { initialsFromName } from "@/lib/profile";
import type {
  HsqDailyReport,
  HsqReportVisitor,
  HsqReportWorker,
  HsqWorkerLookup,
  Profile,
} from "@/lib/types";

/** Supervisors: admins and team leaders. */
export async function getSupervisorOptions(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .in("role", ["admin", "team_leader"])
    .order("full_name", { ascending: true });
  return (data ?? []) as Profile[];
}

/** All named users for the Add Worker attendance dialog. */
export async function getAllUserOptions(): Promise<HsqWorkerLookup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  return (data ?? [])
    .filter((p) => p.full_name?.trim())
    .map((p) => ({
      user_id: p.id,
      full_name: p.full_name!.trim(),
      signature: initialsFromName(p.full_name!.trim()),
    }));
}

export async function listHsqReports(): Promise<HsqDailyReport[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hsq_daily_reports")
    .select("*")
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as HsqDailyReport[];
}

export async function getHsqReportDetail(id: string): Promise<{
  report: HsqDailyReport;
  workers: HsqReportWorker[];
  visitors: HsqReportVisitor[];
} | null> {
  const supabase = await createClient();
  const { data: report } = await supabase
    .from("hsq_daily_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!report) return null;

  const [{ data: workers }, { data: visitors }] = await Promise.all([
    supabase
      .from("hsq_report_workers")
      .select("*")
      .eq("report_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("hsq_report_visitors")
      .select("*")
      .eq("report_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  return {
    report: report as HsqDailyReport,
    workers: (workers ?? []) as HsqReportWorker[],
    visitors: (visitors ?? []) as HsqReportVisitor[],
  };
}
