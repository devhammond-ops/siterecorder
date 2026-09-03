import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireHsqAccess } from "@/lib/auth";
import { getSupervisorOptions } from "@/lib/hsq";
import { profileSignature } from "@/lib/profile";
import { HsqReportForm } from "@/components/hsq-report-form";

export default async function NewHsqReportPage() {
  const user = await requireHsqAccess();
  const admins = await getSupervisorOptions();
  const preparerName = user.profile?.full_name?.trim() || user.email || "Unknown";

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
        <h1 className="text-2xl font-bold">New HSQ Daily Report</h1>
        <p className="text-sm text-muted-foreground">
          Enter the Site ID to load workers from installations logged on the selected date.
        </p>
      </div>
      <HsqReportForm
        mode="create"
        preparerId={user.id}
        preparerName={preparerName}
        supervisors={supervisors}
      />
    </div>
  );
}
