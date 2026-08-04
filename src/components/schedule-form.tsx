"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { INSTALLATION_STATUSES } from "@/lib/constants";
import type { ReportSchedule } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Props {
  schedule?: ReportSchedule;
  onDone?: () => void;
}

export function ScheduleForm({ schedule, onDone }: Props) {
  const router = useRouter();
  const isEdit = !!schedule;

  const [name, setName] = useState(schedule?.name ?? "");
  const [frequency, setFrequency] = useState(schedule?.frequency ?? "weekly");
  const [dayOfWeek, setDayOfWeek] = useState(schedule?.day_of_week ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState(schedule?.day_of_month ?? 1);
  const [sendHour, setSendHour] = useState(schedule?.send_hour ?? 6);
  const [recipients, setRecipients] = useState((schedule?.recipients ?? []).join(", "));
  const [dateRangeMode, setDateRangeMode] = useState(schedule?.date_range_mode ?? "period");
  const [customFrom, setCustomFrom] = useState(schedule?.custom_from ?? "");
  const [customTo, setCustomTo] = useState(schedule?.custom_to ?? "");
  const [statusFilter, setStatusFilter] = useState(schedule?.status_filter ?? "");
  const [active, setActive] = useState(schedule?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const recipientList = recipients
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    if (!name.trim()) return setError("Name is required.");
    if (recipientList.length === 0) return setError("At least one recipient email is required.");

    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: name.trim(),
      frequency,
      day_of_week: frequency === "weekly" ? Number(dayOfWeek) : null,
      day_of_month: frequency === "monthly" ? Number(dayOfMonth) : null,
      send_hour: Number(sendHour),
      recipients: recipientList,
      date_range_mode: dateRangeMode,
      custom_from: dateRangeMode === "custom" && customFrom ? customFrom : null,
      custom_to: dateRangeMode === "custom" && customTo ? customTo : null,
      status_filter: statusFilter || null,
      active,
    };

    try {
      if (isEdit) {
        const { error } = await supabase
          .from("report_schedules")
          .update(payload)
          .eq("id", schedule!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("report_schedules").insert(payload);
        if (error) throw error;
      }
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!schedule) return;
    if (!confirm("Delete this schedule?")) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("report_schedules").delete().eq("id", schedule.id);
    setSaving(false);
    if (error) return setError(error.message);
    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Schedule name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly summary" />
        </div>

        <div>
          <Label className="mb-1.5 block">Frequency</Label>
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value as any)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </div>

        {frequency === "weekly" ? (
          <div>
            <Label className="mb-1.5 block">Day of week</Label>
            <Select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {WEEKDAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div>
            <Label className="mb-1.5 block">Day of month (1-28)</Label>
            <Input
              type="number"
              min={1}
              max={28}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
            />
          </div>
        )}

        <div>
          <Label className="mb-1.5 block">Send hour (UTC, 0-23)</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={sendHour}
            onChange={(e) => setSendHour(Number(e.target.value))}
          />
        </div>

        <div>
          <Label className="mb-1.5 block">Status filter (optional)</Label>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {INSTALLATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Recipients (comma-separated emails)</Label>
          <Input
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="manager@company.com, ops@company.com"
          />
        </div>

        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Report contents</Label>
          <Select value={dateRangeMode} onChange={(e) => setDateRangeMode(e.target.value as any)}>
            <option value="period">Only installations added during the period</option>
            <option value="custom">Custom date range (by install date)</option>
            <option value="all">All installations to date</option>
          </Select>
        </div>

        {dateRangeMode === "custom" && (
          <>
            <div>
              <Label className="mb-1.5 block">From (install date)</Label>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">To (install date)</Label>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </>
        )}

        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="active"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="active">Active</Label>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        {isEdit ? (
          <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {onDone && (
            <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? "Save" : "Create schedule"}
          </Button>
        </div>
      </div>
    </form>
  );
}
