import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InstallationForm } from "@/components/installation-form";

export default function NewInstallationPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <h1 className="text-2xl font-bold">New Installation</h1>
      <InstallationForm mode="create" />
    </div>
  );
}
