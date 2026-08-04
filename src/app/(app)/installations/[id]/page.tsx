import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, FileDown } from "lucide-react";
import { getInstallationWithImages } from "@/lib/installations";
import { requireUser } from "@/lib/auth";
import { CUSTOMER_FIELDS, IMAGE_SLOTS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Installation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteInstallationButton } from "@/components/delete-installation-button";

export default async function InstallationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, user] = await Promise.all([getInstallationWithImages(id), requireUser()]);
  if (!data) notFound();

  const { installation, imagesBySlot } = data;
  const canEdit = user.isAdmin || installation.created_by === user.id;
  const allPaths = Object.values(imagesBySlot).flat().map((i) => i.path);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to installations
        </Link>
        <div className="flex items-center gap-2">
          <a href={`/api/installations/${id}/export/pdf`}>
            <Button size="sm" variant="outline">
              <FileDown className="h-4 w-4" />
              Export PDF
            </Button>
          </a>
          {canEdit && (
            <>
              <Link href={`/installations/${id}/edit`}>
                <Button size="sm" variant="outline">
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <DeleteInstallationButton installationId={id} imagePaths={allPaths} />
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-2xl">{installation.customer_name}</CardTitle>
            <Badge status={installation.status}>{installation.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Order #{installation.order_number} &middot; Updated{" "}
            {formatDateTime(installation.updated_at)}
          </p>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {CUSTOMER_FIELDS.map((f) => {
              const value = installation[f.key as keyof Installation] as string | null;
              return (
                <div key={f.key} className={f.span === 2 ? "sm:col-span-2 lg:col-span-3" : ""}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {f.label}
                  </dt>
                  <dd className="mt-0.5 text-sm">
                    {f.type === "date" ? formatDate(value) : value || "-"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Image Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {IMAGE_SLOTS.map((slot) => {
              const imgs = imagesBySlot[slot.key] ?? [];
              return (
                <div key={slot.key} className="flex flex-col rounded-lg border p-3">
                  <div className="mb-2 min-h-[2.5rem]">
                    <h3 className="text-sm font-medium leading-tight">{slot.label}</h3>
                    {slot.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{slot.description}</p>
                    )}
                    <span className="text-xs text-muted-foreground">({imgs.length})</span>
                  </div>
                  {imgs.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-md border border-dashed py-8 text-xs text-muted-foreground">
                      No photos
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {imgs.map((img) => (
                        <a
                          key={img.id}
                          href={img.url}
                          target="_blank"
                          rel="noreferrer"
                          className="aspect-square overflow-hidden rounded-md border bg-muted"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={slot.label}
                            className="h-full w-full object-cover transition-transform hover:scale-105"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
