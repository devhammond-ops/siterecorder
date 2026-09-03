"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { HSQ_COMPANY, HSQ_HAZARD_ROWS } from "@/lib/hsq-constants";
import { usePersistedState } from "@/lib/form-draft";
import { profileSignature } from "@/lib/profile";
import type { HsqDailyReport, HsqReportWorker, HsqWorkerLookup } from "@/lib/types";
import { SignaturePreview } from "@/components/signature-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SupervisorOption {
  id: string;
  full_name: string;
  signature: string;
}

interface Props {
  mode: "create" | "view";
  preparerId: string;
  preparerName: string;
  supervisors: SupervisorOption[];
  report?: HsqDailyReport;
  workers?: HsqReportWorker[];
}

interface HsqDraft {
  reportDate: string;
  siteId: string;
  location: string;
  taskDescription: string;
  supervisorId: string;
  workers: HsqWorkerLookup[];
}

export function HsqReportForm({
  mode,
  preparerId,
  preparerName,
  supervisors,
  report,
  workers: initialWorkers = [],
}: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const skipLookupRef = useRef(false);
  const restoredSkipSet = useRef(false);
  const readOnly = mode === "view";

  const seed: HsqDraft = {
    reportDate: report?.report_date ?? new Date().toISOString().slice(0, 10),
    siteId: report?.site_id ?? "",
    location: report?.location ?? "",
    taskDescription: report?.task_description ?? "FTTH",
    supervisorId: report?.supervisor_id ?? "",
    workers: initialWorkers.map((w) => ({
      user_id: w.user_id ?? "",
      full_name: w.worker_name,
      signature: w.worker_signature,
    })),
  };

  const [draft, setDraft, clearDraftState, draftReady] = usePersistedState<HsqDraft>(
    "hsq-report:new",
    seed,
    !readOnly
  );

  const { reportDate, siteId, location, taskDescription, supervisorId, workers } = draft;
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSupervisor = supervisors.find((s) => s.id === supervisorId);

  function patchDraft(partial: Partial<HsqDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  const runSiteLookup = useCallback(
    async (id: string, date: string) => {
      const trimmed = id.trim();
      if (!trimmed || !date) return;
      setLookupLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/hsq/lookup?site_id=${encodeURIComponent(trimmed)}&date=${encodeURIComponent(date)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lookup failed");
        setDraft((prev) => ({
          ...prev,
          location: data.location || prev.location,
          taskDescription: data.taskDescription || prev.taskDescription,
          workers: data.workers ?? [],
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to look up site workers");
      } finally {
        setLookupLoading(false);
      }
    },
    [setDraft]
  );

  useEffect(() => {
    if (!draftReady || readOnly) return;
    if (!restoredSkipSet.current) {
      restoredSkipSet.current = true;
      if (siteId.trim() && workers.length > 0) {
        skipLookupRef.current = true;
      }
    }
  }, [draftReady, readOnly, siteId, workers.length]);

  useEffect(() => {
    if (!draftReady || readOnly || !siteId.trim()) return;
    if (skipLookupRef.current) {
      skipLookupRef.current = false;
      return;
    }
    // Wait for typing/pasting to finish before fetching workers.
    const timer = setTimeout(() => {
      runSiteLookup(siteId, reportDate);
    }, 1200);
    return () => clearTimeout(timer);
  }, [siteId, reportDate, readOnly, runSiteLookup, draftReady]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current || readOnly) return;

    if (!siteId.trim()) {
      setError("Site ID is required.");
      return;
    }
    if (!supervisorId) {
      setError("Please select a supervisor.");
      return;
    }
    if (!selectedSupervisor) {
      setError("Invalid supervisor selection.");
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const preparedSignature = profileSignature(preparerName);

    try {
      const { data: row, error: insErr } = await supabase
        .from("hsq_daily_reports")
        .insert({
          report_date: reportDate,
          site_id: siteId.trim(),
          location: location.trim() || null,
          task_description: taskDescription.trim() || "FTTH",
          prepared_by: preparerId,
          prepared_by_name: preparerName,
          prepared_by_signature: preparedSignature,
          supervisor_id: supervisorId,
          supervisor_name: selectedSupervisor.full_name,
          supervisor_signature: selectedSupervisor.signature,
          status: "submitted",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      const reportId = row.id as string;
      if (workers.length > 0) {
        const { error: workerErr } = await supabase.from("hsq_report_workers").insert(
          workers.map((w, index) => ({
            report_id: reportId,
            user_id: w.user_id || null,
            worker_name: w.full_name,
            worker_signature: w.signature,
            sort_order: index,
          }))
        );
        if (workerErr) throw workerErr;
      }

      clearDraftState();
      router.push(`/hsq/${reportId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save report");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Daily Hazard Risk Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="report_date">Report date</Label>
              <Input
                id="report_date"
                type="date"
                value={reportDate}
                onChange={(e) => patchDraft({ reportDate: e.target.value })}
                disabled={readOnly}
                required
              />
            </div>
            <div>
              <Label htmlFor="site_id">
                Site ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="site_id"
                value={siteId}
                onChange={(e) => patchDraft({ siteId: e.target.value })}
                placeholder="Enter site identifier"
                disabled={readOnly}
                required
              />
              {lookupLoading && (
                <p className="mt-1 text-xs text-muted-foreground">Looking up workers…</p>
              )}
            </div>
          </div>

          <div className="rounded-md border divide-y text-sm">
            <div className="grid grid-cols-2 gap-4 p-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="font-medium">{HSQ_COMPANY}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium">{reportDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium">{location || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Description of Task</p>
                <p className="font-medium">{taskDescription}</p>
              </div>
            </div>
          </div>
          {!readOnly && (
            <p className="text-xs text-muted-foreground">
              Your entries are kept if the page reloads before you save. Worker lookup waits until
              you finish typing the Site ID.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Hazard Assessment</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-2 font-medium">Basic Task Steps</th>
                <th className="p-2 font-medium">Hazards</th>
                <th className="p-2 font-medium text-center">Initial Risk</th>
                <th className="p-2 font-medium">Precautions</th>
                <th className="p-2 font-medium text-center">Final Risk</th>
                <th className="p-2 font-medium text-center">Assessor Initials</th>
              </tr>
            </thead>
            <tbody>
              {HSQ_HAZARD_ROWS.map((row, i) => (
                <tr key={i} className="border-b align-top">
                  <td className="p-2">{row.taskStep}</td>
                  <td className="p-2">{row.hazards}</td>
                  <td className="p-2 text-center">{row.initialRisk}</td>
                  <td className="p-2">{row.precautions}</td>
                  <td className="p-2 text-center">{row.finalRisk}</td>
                  <td className="p-2 text-center">
                    {preparerName ? profileSignature(preparerName) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Prepared By</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Auto-filled from the team leader who creates this report.
            </p>
            <div>
              <Label>Name</Label>
              <p className="text-sm font-medium">{preparerName}</p>
            </div>
            <div>
              <Label>Signature</Label>
              <SignaturePreview fullName={preparerName} className="mt-1 min-h-[4rem]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supervisor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select an admin supervisor. Signature is generated from their profile name.
            </p>
            <div>
              <Label htmlFor="supervisor">Supervisor</Label>
              <Select
                id="supervisor"
                value={supervisorId}
                onChange={(e) => patchDraft({ supervisorId: e.target.value })}
                disabled={readOnly}
                required
              >
                <option value="">Select supervisor…</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </div>
            {selectedSupervisor && (
              <div>
                <Label>Signature</Label>
                <SignaturePreview
                  fullName={selectedSupervisor.full_name}
                  className="mt-1 min-h-[4rem]"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workers Sign On</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Populated automatically when Site ID is entered — all technicians who logged
            installations at this site on the selected date.
          </p>
          {workers.length === 0 ? (
            <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              Enter a Site ID to load workers from installations for this date.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-2 font-medium">Name (Please print)</th>
                  <th className="p-2 font-medium">Signature</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.user_id || w.full_name} className="border-b">
                    <td className="p-2">{w.full_name}</td>
                    <td className="p-2 font-medium">{w.signature}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!readOnly && (
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Create report
          </Button>
        </div>
      )}
    </form>
  );
}
