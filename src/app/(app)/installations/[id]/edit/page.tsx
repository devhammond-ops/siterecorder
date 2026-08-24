import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getInstallationWithImages } from "@/lib/installations";
import { InstallationForm } from "@/components/installation-form";

export default async function EditInstallationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getInstallationWithImages(id);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/installations/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <h1 className="text-2xl font-bold">
        Edit: {data.installation.customer_name}
      </h1>
      <InstallationForm
        mode="edit"
        installation={data.installation}
        sitePhotos={data.sitePhotos}
        acceptanceForms={data.acceptanceForms}
      />
    </div>
  );
}
