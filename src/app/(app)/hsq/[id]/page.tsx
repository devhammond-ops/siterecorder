import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { requireHsqAccess } from "@/lib/auth";
import { getHsqReportDetail, getSupervisorOptions } from "@/lib/hsq";
import { profileSignature } from "@/lib/profile";
import { HsqReportForm } from "@/components/hsq-report-form";
import { Button } from "@/components/ui/button";

export default async function HsqReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireHsqAccess();
  const { id } = await params;
  const [data, supervisorsRaw] = await Promise.all([
    getHsqReportDetail(id),
    getSupervisorOptions(),
  ]);
  if (!data) notFound();

  const { report, workers, visitors, safetyPhotos } = data;
  const supervisors = supervisorsRaw.map((a) => ({
    id: a.id,
    full_name: a.full_name ?? "(no name)",
    signature: profileSignature(a.full_name),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/hsq"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to HSQ reports
        </Link>
        <a href={`/api/hsq/${id}/export/pdf`}>
          <Button size="sm" variant="outline">
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
        </a>
      </div>
      <div>
        <h1 className="text-2xl font-bold">HSQ Report — {report.location}</h1>
        <p className="text-sm text-muted-foreground">
          {report.task_description} · {report.report_date}
        </p>
      </div>
      <HsqReportForm
        mode="view"
        preparerId={report.prepared_by}
        preparerName={report.prepared_by_name}
        supervisors={supervisors}
        report={report}
        workers={workers}
        visitors={visitors}
        safetyPhotos={safetyPhotos}
      />
    </div>
  );
}
