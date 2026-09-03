import Link from "next/link";
import { Plus } from "lucide-react";
import { requireHsqAccess } from "@/lib/auth";
import { listHsqReports } from "@/lib/hsq";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function HsqReportsPage() {
  await requireHsqAccess();
  const reports = await listHsqReports();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">HSQ Daily Reports</h1>
          <p className="text-sm text-muted-foreground">
            Daily Hazard Risk Assessment reports for site installations.
          </p>
        </div>
        <Link href="/hsq/new">
          <Button>
            <Plus className="h-4 w-4" />
            New report
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No HSQ reports yet. Create one to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Site ID</th>
                    <th className="px-3 py-2 font-medium">Location</th>
                    <th className="px-3 py-2 font-medium">Prepared by</th>
                    <th className="px-3 py-2 font-medium">Supervisor</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reports.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <Link href={`/hsq/${r.id}`} className="font-medium hover:underline">
                          {formatDate(r.report_date)}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{r.site_id}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.location || "—"}</td>
                      <td className="px-3 py-2">{r.prepared_by_name}</td>
                      <td className="px-3 py-2">{r.supervisor_name || "—"}</td>
                      <td className="px-3 py-2">
                        <Badge status={r.status}>{r.status}</Badge>
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
