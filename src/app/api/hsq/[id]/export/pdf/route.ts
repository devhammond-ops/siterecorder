import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildHsqPdf, fetchHsqImageBytes } from "@/lib/pdf/hsq-pdf";
import type {
  HsqDailyReport,
  HsqReportImage,
  HsqReportVisitor,
  HsqReportWorker,
  UserRole,
} from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile?.role as UserRole) ?? "technician";
  if (role !== "admin" && role !== "team_leader") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: report, error } = await supabase
    .from("hsq_daily_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: workers }, { data: visitors }, { data: imageRows }] = await Promise.all([
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
    supabase
      .from("hsq_report_images")
      .select("*")
      .eq("report_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const images = await fetchHsqImageBytes(supabase, (imageRows ?? []) as HsqReportImage[]);
  const pdfBytes = await buildHsqPdf(
    report as HsqDailyReport,
    (workers ?? []) as HsqReportWorker[],
    (visitors ?? []) as HsqReportVisitor[],
    images
  );

  const safeName = String(report.location)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  const filename = `hsq-${safeName || id.slice(0, 8)}.pdf`;

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
