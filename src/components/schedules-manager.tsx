"use client";

import { useState } from "react";
import { Plus, Pencil, Send, Loader2, Clock } from "lucide-react";
import type { ReportSchedule, ReportRun } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleForm } from "@/components/schedule-form";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describe(s: ReportSchedule): string {
  const when =
    s.frequency === "weekly"
      ? `Weekly on ${WEEKDAYS[s.day_of_week ?? 1]}`
      : `Monthly on day ${s.day_of_month ?? 1}`;
  return `${when} at ${String(s.send_hour).padStart(2, "0")}:00 UTC`;
}

export function SchedulesManager({
  schedules,
  runs,
}: {
  schedules: ReportSchedule[];
  runs: ReportRun[];
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function sendTest(id: string) {
    setTestingId(id);
    setMessage(null);
    try {
      const res = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const r = data.results?.[0];
      setMessage(
        r
          ? `Test sent: ${r.installations ?? 0} installation(s), ${r.recipients ?? 0} recipient(s).`
          : "No matching schedule was due."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to run test");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Report Schedules</h1>
          <p className="text-sm text-muted-foreground">
            Automated PDF reports emailed on a recurring schedule.
          </p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New schedule
          </Button>
        )}
      </div>

      {message && (
        <div className="rounded-md border bg-accent/50 px-4 py-2 text-sm">{message}</div>
      )}

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>New schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduleForm onDone={() => setCreating(false)} />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {schedules.map((s) =>
          editingId === s.id ? (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle>Edit: {s.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <ScheduleForm schedule={s} onDone={() => setEditingId(null)} />
              </CardContent>
            </Card>
          ) : (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{s.name}</p>
                    {s.active ? (
                      <Badge className="border-green-200 bg-green-100 text-green-800">active</Badge>
                    ) : (
                      <Badge className="border-border bg-muted text-muted-foreground">paused</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{describe(s)}</p>
                  <p className="text-xs text-muted-foreground">
                    To: {s.recipients.join(", ") || "(none)"} &middot; Contents:{" "}
                    {s.date_range_mode} &middot; Last run:{" "}
                    {s.last_run_at ? formatDateTime(s.last_run_at) : "never"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendTest(s.id)}
                    disabled={testingId === s.id}
                  >
                    {testingId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send test
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(s.id)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        )}
        {schedules.length === 0 && !creating && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Clock className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No schedules yet. Create one to start sending automated reports.
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Period</th>
                    <th className="px-3 py-2 font-medium">Recipients</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{formatDateTime(r.ran_at)}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.period_from ?? "start"} - {r.period_to ?? "-"}
                      </td>
                      <td className="px-3 py-2">{r.recipient_count}</td>
                      <td className="px-3 py-2">
                        {r.status === "success" ? (
                          <Badge className="border-green-200 bg-green-100 text-green-800">
                            success
                          </Badge>
                        ) : (
                          <span title={r.error ?? ""}>
                            <Badge className="border-red-200 bg-red-100 text-red-800">error</Badge>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
