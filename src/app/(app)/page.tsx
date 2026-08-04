import Link from "next/link";
import { Plus, FileSpreadsheet, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { applyInstallationFilters, parseFilters } from "@/lib/filters";
import { formatDate } from "@/lib/utils";
import type { Installation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/filter-bar";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const supabase = await createClient();

  let query = supabase
    .from("installations")
    .select(
      "id, customer_name, order_number, msisdn, customer_address, network_type, date_installation, status, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  query = applyInstallationFilters(query, filters);

  const { data, error } = await query;
  const installations = (data ?? []) as Partial<Installation>[];

  const exportQs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][]
  ).toString();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Installations</h1>
          <p className="text-sm text-muted-foreground">
            {installations.length} record{installations.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/export/excel${exportQs ? `?${exportQs}` : ""}`}>
            <Button variant="outline">
              <FileSpreadsheet className="h-4 w-4" />
              Export to Excel
            </Button>
          </a>
          <Link href="/installations/new">
            <Button>
              <Plus className="h-4 w-4" />
              New Installation
            </Button>
          </Link>
        </div>
      </div>

      <FilterBar />

      {error && (
        <p className="text-sm text-destructive">Failed to load: {error.message}</p>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Order #</th>
                <th className="px-4 py-3 font-medium">MSISDN</th>
                <th className="px-4 py-3 font-medium">Network</th>
                <th className="px-4 py-3 font-medium">Install Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {installations.map((inst) => (
                <tr key={inst.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/installations/${inst.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {inst.customer_name}
                    </Link>
                    <div className="max-w-[240px] truncate text-xs text-muted-foreground">
                      {inst.customer_address}
                    </div>
                  </td>
                  <td className="px-4 py-3">{inst.order_number}</td>
                  <td className="px-4 py-3">{inst.msisdn || "-"}</td>
                  <td className="px-4 py-3">{inst.network_type || "-"}</td>
                  <td className="px-4 py-3">{formatDate(inst.date_installation)}</td>
                  <td className="px-4 py-3">
                    <Badge status={inst.status}>{inst.status}</Badge>
                  </td>
                </tr>
              ))}
              {installations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No installations found. Create your first entry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
