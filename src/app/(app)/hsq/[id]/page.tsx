import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireHsqAccess } from "@/lib/auth";
import { getHsqReportWithWorkers, getSupervisorOptions } from "@/lib/hsq";
import { profileSignature } from "@/lib/profile";
import { HsqReportForm } from "@/components/hsq-report-form";

export default async function HsqReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireHsqAccess();
  const { id } = await params;
  const [data, admins] = await Promise.all([
    getHsqReportWithWorkers(id),
    getSupervisorOptions(),
  ]);
  if (!data) notFound();

  const { report, workers } = data;
  const supervisors = admins.map((a) => ({
    id: a.id,
    full_name: a.full_name ?? "(no name)",
    signature: profileSignature(a.full_name),
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/hsq"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to HSQ reports
      </Link>
      <div>
        <h1 className="text-2xl font-bold">HSQ Report — {report.site_id}</h1>
        <p className="text-sm text-muted-foreground">
          {report.location || "No location"} · {report.report_date}
        </p>
      </div>
      <HsqReportForm
        mode="view"
        preparerId={report.prepared_by}
        preparerName={report.prepared_by_name}
        supervisors={supervisors}
        report={report}
        workers={workers}
      />
    </div>
  );
}
