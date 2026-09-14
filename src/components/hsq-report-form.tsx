"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { HSQ_IMAGES_BUCKET, HSQ_SAFETY_PHOTOS_SLOT } from "@/lib/constants";
import {
  emptyPpeChecklist,
  HSQ_COMPANY,
  HSQ_DEFAULT_TASK,
  HSQ_HAZARD_ROWS,
  HSQ_PPE_ITEMS,
  HSQ_PROBABILITY_LABELS,
  HSQ_SBC,
  HSQ_SEVERITY_CONSEQUENCES,
  HSQ_SEVERITY_LABELS,
  riskAcceptanceText,
  riskBand,
  type PpeChecklistState,
  type PpeRemark,
  type PpeResult,
} from "@/lib/hsq-constants";
import { usePersistedState } from "@/lib/form-draft";
import { profileSignature } from "@/lib/profile";
import type {
  HsqDailyReport,
  HsqReportVisitor,
  HsqReportWorker,
} from "@/lib/types";
import { SignaturePreview } from "@/components/signature-preview";
import { ImageUploader } from "@/components/image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HsqSafetyPhoto } from "@/lib/hsq";

interface SupervisorOption {
  id: string;
  full_name: string;
  signature: string;
}

interface WorkerDraft {
  key: string;
  worker_name: string;
  worker_signature: string;
}

interface VisitorDraft {
  key: string;
  visitor_name: string;
  visitor_signature: string;
  visit_time: string;
}

interface Props {
  mode: "create" | "view";
  preparerId: string;
  preparerName: string;
  supervisors: SupervisorOption[];
  report?: HsqDailyReport;
  workers?: HsqReportWorker[];
  visitors?: HsqReportVisitor[];
  safetyPhotos?: HsqSafetyPhoto[];
}

interface HsqDraft {
  reportDate: string;
  location: string;
  taskDescription: string;
  supervisorId: string;
  riskProbability: number | null;
  riskSeverity: number | null;
  workers: WorkerDraft[];
  visitors: VisitorDraft[];
  ppe: PpeChecklistState;
}

function bandCellClass(score: number, selected: boolean) {
  const band = riskBand(score);
  const base =
    band === "high"
      ? "bg-red-600 text-white"
      : band === "medium"
        ? "bg-amber-300 text-amber-950"
        : "bg-emerald-500 text-white";
  return cn(base, selected && "ring-2 ring-offset-2 ring-foreground scale-105");
}

export function HsqReportForm({
  mode,
  preparerId,
  preparerName,
  supervisors,
  report,
  workers: initialWorkers = [],
  visitors: initialVisitors = [],
  safetyPhotos = [],
}: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const readOnly = mode === "view";

  const seed: HsqDraft = {
    reportDate: report?.report_date ?? new Date().toISOString().slice(0, 10),
    location: report?.location ?? "",
    taskDescription: report?.task_description ?? HSQ_DEFAULT_TASK,
    supervisorId: report?.supervisor_id ?? "",
    riskProbability: report?.risk_probability ?? null,
    riskSeverity: report?.risk_severity ?? null,
    workers: initialWorkers.map((w, i) => ({
      key: w.id || `w-${i}`,
      worker_name: w.worker_name,
      worker_signature: w.worker_signature,
    })),
    visitors: initialVisitors.map((v, i) => ({
      key: v.id || `v-${i}`,
      visitor_name: v.visitor_name,
      visitor_signature: v.visitor_signature ?? "",
      visit_time: v.visit_time ?? "",
    })),
    ppe: {
      ...emptyPpeChecklist(),
      ...(report?.ppe_checklist as PpeChecklistState | undefined),
    },
  };

  const [draft, setDraft, clearDraftState] = usePersistedState<HsqDraft>(
    "hsq-report:v3",
    seed,
    !readOnly
  );

  const {
    reportDate,
    location,
    taskDescription,
    supervisorId,
    riskProbability,
    riskSeverity,
    workers,
    visitors,
    ppe,
  } = draft;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSafetyPhotos, setPendingSafetyPhotos] = useState<File[]>([]);

  const selectedSupervisor = supervisors.find((s) => s.id === supervisorId);
  const riskScore =
    riskProbability && riskSeverity ? riskProbability * riskSeverity : null;

  const ppeAllPass = HSQ_PPE_ITEMS.every((item) => ppe[item.id]?.result === "PASS");
  const ppeAllFail = HSQ_PPE_ITEMS.every((item) => ppe[item.id]?.result === "FAIL");
  const ppeAllNa = HSQ_PPE_ITEMS.every((item) => ppe[item.id]?.result === "N/A");

  function patchDraft(partial: Partial<HsqDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function setRiskCell(probability: number, severity: number) {
    if (readOnly) return;
    patchDraft({ riskProbability: probability, riskSeverity: severity });
  }

  function setAllPpe(result: PpeResult) {
    if (readOnly || !result) return;
    const next: PpeChecklistState = { ...ppe };
    for (const item of HSQ_PPE_ITEMS) {
      next[item.id] = {
        result,
        remarks: result === "FAIL" ? next[item.id]?.remarks ?? [] : [],
      };
    }
    patchDraft({ ppe: next });
  }

  function addWorker() {
    patchDraft({
      workers: [
        ...workers,
        {
          key: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          worker_name: "",
          worker_signature: "",
        },
      ],
    });
  }

  function updateWorker(key: string, partial: Partial<WorkerDraft>) {
    patchDraft({
      workers: workers.map((w) => (w.key === key ? { ...w, ...partial } : w)),
    });
  }

  function removeWorker(key: string) {
    patchDraft({ workers: workers.filter((w) => w.key !== key) });
  }

  function addVisitor() {
    patchDraft({
      visitors: [
        ...visitors,
        {
          key: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          visitor_name: "",
          visitor_signature: "",
          visit_time: "",
        },
      ],
    });
  }

  function updateVisitor(key: string, partial: Partial<VisitorDraft>) {
    patchDraft({
      visitors: visitors.map((v) => (v.key === key ? { ...v, ...partial } : v)),
    });
  }

  function removeVisitor(key: string) {
    patchDraft({ visitors: visitors.filter((v) => v.key !== key) });
  }

  function setPpeResult(id: string, result: PpeResult) {
    const current = ppe[id] ?? { result: "", remarks: [] };
    patchDraft({
      ppe: {
        ...ppe,
        [id]: {
          result,
          remarks: result === "FAIL" ? current.remarks : [],
        },
      },
    });
  }

  function togglePpeRemark(id: string, remark: PpeRemark) {
    const current = ppe[id] ?? { result: "", remarks: [] };
    if (current.result !== "FAIL") return;
    const has = current.remarks.includes(remark);
    patchDraft({
      ppe: {
        ...ppe,
        [id]: {
          ...current,
          remarks: has
            ? current.remarks.filter((r) => r !== remark)
            : [...current.remarks, remark],
        },
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current || readOnly) return;

    if (!location.trim()) {
      setError("Site location is required.");
      return;
    }
    if (!supervisorId || !selectedSupervisor) {
      setError("Please select a supervisor.");
      return;
    }
    if (!riskProbability || !riskSeverity || !riskScore) {
      setError("Select a cell on the risk rating matrix.");
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
          location: location.trim(),
          task_description: taskDescription.trim() || HSQ_DEFAULT_TASK,
          prepared_by: preparerId,
          prepared_by_name: preparerName,
          prepared_by_signature: preparedSignature,
          supervisor_id: supervisorId,
          supervisor_name: selectedSupervisor.full_name,
          supervisor_signature: selectedSupervisor.signature,
          risk_probability: riskProbability,
          risk_severity: riskSeverity,
          risk_score: riskScore,
          ppe_checklist: ppe,
          status: "submitted",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      const reportId = row.id as string;
      let uploadedPaths: string[] = [];

      try {
        if (workers.length > 0) {
          const workerRows = workers.filter((w) => w.worker_name.trim());
          if (workerRows.length > 0) {
            const { error: workerErr } = await supabase.from("hsq_report_workers").insert(
              workerRows.map((w, index) => ({
                report_id: reportId,
                user_id: null,
                worker_name: w.worker_name.trim(),
                worker_signature: w.worker_signature.trim() || "—",
                sort_order: index,
              }))
            );
            if (workerErr) throw workerErr;
          }
        }

        const visitorRows = visitors.filter((v) => v.visitor_name.trim());
        if (visitorRows.length > 0) {
          const { error: visitorErr } = await supabase.from("hsq_report_visitors").insert(
            visitorRows.map((v, index) => ({
              report_id: reportId,
              visitor_name: v.visitor_name.trim(),
              visitor_signature: v.visitor_signature.trim() || null,
              visit_time: v.visit_time.trim() || null,
              sort_order: index,
            }))
          );
          if (visitorErr) throw visitorErr;
        }

        for (const file of pendingSafetyPhotos) {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${reportId}/${HSQ_SAFETY_PHOTOS_SLOT}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(HSQ_IMAGES_BUCKET)
            .upload(path, file, { upsert: false });
          if (upErr) throw upErr;
          uploadedPaths.push(path);

          const { error: imgErr } = await supabase.from("hsq_report_images").insert({
            report_id: reportId,
            slot: HSQ_SAFETY_PHOTOS_SLOT,
            storage_path: path,
            uploaded_by: preparerId,
          });
          if (imgErr) throw imgErr;
        }
      } catch (innerErr) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(HSQ_IMAGES_BUCKET).remove(uploadedPaths);
        }
        await supabase.from("hsq_daily_reports").delete().eq("id", reportId);
        throw innerErr;
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

  let lastPpeGroup = "";

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
              <Label htmlFor="location">
                Site location <span className="text-destructive">*</span>
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => patchDraft({ location: e.target.value })}
                placeholder="e.g. Atomic Roundabout Taifa - Dome"
                disabled={readOnly}
                required
              />
            </div>
            <div>
              <Label htmlFor="task">Description of Task</Label>
              <Input
                id="task"
                value={taskDescription}
                onChange={(e) => patchDraft({ taskDescription: e.target.value })}
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="rounded-md border text-sm">
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
            <SignaturePreview fullName={preparerName} className="min-h-[4rem]" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supervisor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select an admin or team leader. Signature is generated from their profile.
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
              <SignaturePreview
                fullName={selectedSupervisor.full_name}
                className="min-h-[4rem]"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk Rating Matrix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tap a cell to set Probability × Severity for this site day.
            {riskScore != null && (
              <>
                {" "}
                Selected score: <strong>{riskScore}</strong> ({riskBand(riskScore)}) —{" "}
                {riskAcceptanceText(riskScore)}
              </>
            )}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-center text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left">Probability \\ Severity</th>
                  {HSQ_SEVERITY_LABELS.map((s) => (
                    <th key={s.value} className="p-2 font-medium">
                      {s.value} {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HSQ_PROBABILITY_LABELS.map((p) => (
                  <tr key={p.value}>
                    <td className="p-2 text-left font-medium">
                      {p.value} {p.label}
                    </td>
                    {HSQ_SEVERITY_LABELS.map((s) => {
                      const score = p.value * s.value;
                      const selected =
                        riskProbability === p.value && riskSeverity === s.value;
                      return (
                        <td key={s.value} className="p-1">
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => setRiskCell(p.value, s.value)}
                            className={cn(
                              "h-10 w-full rounded text-sm font-semibold transition",
                              bandCellClass(score, selected),
                              readOnly && "cursor-default opacity-90"
                            )}
                          >
                            {score}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-2">Risk Rating</th>
                  <th className="p-2">Risk Acceptance Authority</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2">
                    <span className="rounded bg-emerald-500 px-2 py-0.5 text-white">1 to 4 (Low)</span>
                  </td>
                  <td className="p-2">Risk is tolerable, manage at local level</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">
                    <span className="rounded bg-amber-300 px-2 py-0.5 text-amber-950">
                      5 to 9 (Medium)
                    </span>
                  </td>
                  <td className="p-2">
                    Risk requires approval by Operations Lead/Supervisor & Safety Manager
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">
                    <span className="rounded bg-red-600 px-2 py-0.5 text-white">10 to 25 (High)</span>
                  </td>
                  <td className="p-2">
                    Risk requires the approval of the Operations Manager & Safety Director
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-2">Severity</th>
                  <th className="p-2">People</th>
                  <th className="p-2">Property Damage</th>
                  <th className="p-2">Environmental Impact</th>
                  <th className="p-2">Public Image/Reputation</th>
                </tr>
              </thead>
              <tbody>
                {HSQ_SEVERITY_CONSEQUENCES.map((row) => (
                  <tr key={row.label} className="border-b align-top">
                    <td className="p-2 font-medium">{row.label}</td>
                    <td className="p-2">{row.people}</td>
                    <td className="p-2">{row.property}</td>
                    <td className="p-2">{row.environment}</td>
                    <td className="p-2">{row.reputation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-2">Probability</th>
                  <th className="p-2">Definition</th>
                  <th className="p-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {HSQ_PROBABILITY_LABELS.map((p) => (
                  <tr key={p.value} className="border-b">
                    <td className="p-2 font-medium">{p.label}</td>
                    <td className="p-2">{p.definition}</td>
                    <td className="p-2">{p.ratio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Workers Sign On</CardTitle>
            {!readOnly && (
              <Button type="button" size="sm" onClick={addWorker}>
                <Plus className="h-4 w-4" />
                Add worker
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {workers.length === 0 ? (
              <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                No workers recorded.
              </p>
            ) : (
              workers.map((w) => (
                <div
                  key={w.key}
                  className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <Input
                    placeholder="Name (Please print)"
                    value={w.worker_name}
                    disabled={readOnly}
                    onChange={(e) => updateWorker(w.key, { worker_name: e.target.value })}
                  />
                  <Input
                    placeholder="Signature"
                    value={w.worker_signature}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateWorker(w.key, { worker_signature: e.target.value })
                    }
                  />
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWorker(w.key)}
                      aria-label="Remove worker"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Visitor Sign On</CardTitle>
            {!readOnly && (
              <Button type="button" size="sm" variant="outline" onClick={addVisitor}>
                <Plus className="h-4 w-4" />
                Add visitor
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {visitors.length === 0 ? (
              <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                No visitors recorded.
              </p>
            ) : (
              visitors.map((v) => (
                <div key={v.key} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-3">
                  <Input
                    placeholder="Name"
                    value={v.visitor_name}
                    disabled={readOnly}
                    onChange={(e) => updateVisitor(v.key, { visitor_name: e.target.value })}
                  />
                  <Input
                    placeholder="Signature"
                    value={v.visitor_signature}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateVisitor(v.key, { visitor_signature: e.target.value })
                    }
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Time"
                      value={v.visit_time}
                      disabled={readOnly}
                      onChange={(e) => updateVisitor(v.key, { visit_time: e.target.value })}
                    />
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVisitor(v.key)}
                        aria-label="Remove visitor"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subcontractor PPE Inspection Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Project</p>
              <p className="font-medium">{taskDescription || HSQ_DEFAULT_TASK}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">SBC</p>
              <p className="font-medium">{HSQ_SBC}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium">{location || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium">{reportDate}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {!readOnly && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">Set all checklist items to:</span>
                <Button
                  type="button"
                  size="sm"
                  variant={ppeAllPass ? "default" : "outline"}
                  onClick={() => setAllPpe("PASS")}
                >
                  Pass
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={ppeAllFail ? "default" : "outline"}
                  onClick={() => setAllPpe("FAIL")}
                >
                  Fail
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={ppeAllNa ? "default" : "outline"}
                  onClick={() => setAllPpe("N/A")}
                >
                  N/A
                </Button>
              </div>
            )}
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-2">Item</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>PASS</span>
                      {!readOnly && (
                        <button
                          type="button"
                          className="text-[10px] font-normal text-primary underline-offset-2 hover:underline"
                          onClick={() => setAllPpe("PASS")}
                        >
                          Select all
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="p-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>FAIL</span>
                      {!readOnly && (
                        <button
                          type="button"
                          className="text-[10px] font-normal text-primary underline-offset-2 hover:underline"
                          onClick={() => setAllPpe("FAIL")}
                        >
                          Select all
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="p-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>N/A</span>
                      {!readOnly && (
                        <button
                          type="button"
                          className="text-[10px] font-normal text-primary underline-offset-2 hover:underline"
                          onClick={() => setAllPpe("N/A")}
                        >
                          Select all
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="p-2">Remark if Fail</th>
                </tr>
              </thead>
              <tbody>
                {HSQ_PPE_ITEMS.map((item) => {
                  const showGroup = item.group !== lastPpeGroup;
                  lastPpeGroup = item.group;
                  const answer = ppe[item.id] ?? { result: "", remarks: [] };
                  return (
                    <tr key={item.id} className="border-b align-middle">
                      <td className="p-2 font-medium">{showGroup ? item.group : ""}</td>
                      <td className="p-2">{item.description}</td>
                      {(["PASS", "FAIL", "N/A"] as PpeResult[]).map((opt) => (
                        <td key={opt} className="p-2 text-center">
                          <input
                            type="radio"
                            name={`ppe-${item.id}`}
                            checked={answer.result === opt}
                            disabled={readOnly}
                            onChange={() => setPpeResult(item.id, opt)}
                          />
                        </td>
                      ))}
                      <td className="p-2">
                        <div className="flex flex-wrap gap-2">
                          {(["Clean", "Repair", "Replace"] as PpeRemark[]).map((remark) => (
                            <label
                              key={remark}
                              className={cn(
                                "inline-flex items-center gap-1",
                                answer.result !== "FAIL" && "opacity-40"
                              )}
                            >
                              <input
                                type="checkbox"
                                disabled={readOnly || answer.result !== "FAIL"}
                                checked={answer.remarks.includes(remark)}
                                onChange={() => togglePpeRemark(item.id, remark)}
                              />
                              {remark}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Admintelecom Rep</p>
              <p className="font-medium">{preparerName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Signature</p>
              <p className="font-medium">{profileSignature(preparerName)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium">{reportDate}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safety Pictures</CardTitle>
        </CardHeader>
        <CardContent>
          {readOnly ? (
            safetyPhotos.length === 0 ? (
              <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                No safety pictures
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {safetyPhotos.map((img) => (
                  <a
                    key={img.id}
                    href={img.url}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square overflow-hidden rounded-md border bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )
          ) : (
            <>
              <ImageUploader
                mode="create"
                slot={HSQ_SAFETY_PHOTOS_SLOT}
                hint="Use Choose from device for gallery photos, or Take photo for the camera."
                onPendingChange={setPendingSafetyPhotos}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Photos are uploaded when you save the report. Optional — add site safety evidence.
              </p>
            </>
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
