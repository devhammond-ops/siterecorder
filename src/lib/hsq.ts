import { createClient } from "@/lib/supabase/server";
import { initialsFromName } from "@/lib/profile";
import { HSQ_DEFAULT_TASK } from "@/lib/hsq-constants";
import type { HsqDailyReport, HsqReportWorker, HsqWorkerLookup, Profile } from "@/lib/types";

export interface HsqSiteLookupResult {
  location: string | null;
  taskDescription: string;
  workers: HsqWorkerLookup[];
}

function locationFromInstallation(row: {
  gps_address: string | null;
  customer_address: string | null;
}): string | null {
  const gps = row.gps_address?.trim();
  if (gps) {
    const part = gps.split(/[-,]/)[0]?.trim();
    if (part) return part.toUpperCase();
  }
  const addr = row.customer_address?.trim();
  if (addr) {
    const part = addr.split(/[,]/)[0]?.trim();
    if (part) return part.toUpperCase();
  }
  return null;
}

/** Fetch admins for the supervisor dropdown. */
export async function getSupervisorOptions(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "admin")
    .order("full_name", { ascending: true });
  return (data ?? []) as Profile[];
}

/** Resolve workers and location from site ID + report date. */
export async function lookupHsqSiteWorkers(
  siteId: string,
  reportDate: string
): Promise<HsqSiteLookupResult> {
  const supabase = await createClient();
  const normalizedSiteId = siteId.trim();

  const { data: installations } = await supabase
    .from("installations")
    .select("created_by, gps_address, customer_address, network_type")
    .eq("date_installation", reportDate)
    .ilike("site_id", normalizedSiteId);

  const rows = installations ?? [];
  let location: string | null = null;
  let taskDescription = HSQ_DEFAULT_TASK;

  if (rows.length > 0) {
    location = locationFromInstallation(rows[0]);
    const networkType = rows[0].network_type?.trim();
    if (networkType) taskDescription = networkType.toUpperCase();
  }

  const userIds = [
    ...new Set(
      rows
        .map((r) => r.created_by)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  if (userIds.length === 0) {
    return { location, taskDescription, workers: [] };
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const workers: HsqWorkerLookup[] = (profiles ?? [])
    .filter((p) => p.full_name?.trim())
    .map((p) => ({
      user_id: p.id,
      full_name: p.full_name!.trim(),
      signature: initialsFromName(p.full_name!.trim()),
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return { location, taskDescription, workers };
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

export async function getHsqReportWithWorkers(id: string): Promise<{
  report: HsqDailyReport;
  workers: HsqReportWorker[];
} | null> {
  const supabase = await createClient();
  const { data: report } = await supabase
    .from("hsq_daily_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!report) return null;

  const { data: workers } = await supabase
    .from("hsq_report_workers")
    .select("*")
    .eq("report_id", id)
    .order("sort_order", { ascending: true });

  return {
    report: report as HsqDailyReport,
    workers: (workers ?? []) as HsqReportWorker[],
  };
}
