"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ACCEPTANCE_FORM_SLOT,
  CUSTOMER_FIELDS,
  INSTALLATION_STATUSES,
  SITE_PHOTOS_SLOT,
  STORAGE_BUCKET,
} from "@/lib/constants";
import type { Installation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploader, type SlotImage } from "@/components/image-uploader";

interface Props {
  mode: "create" | "edit";
  installation?: Installation;
  sitePhotos?: SlotImage[];
  acceptanceForms?: SlotImage[];
}

type FormValues = Record<string, string>;

async function uploadFiles(
  supabase: ReturnType<typeof createClient>,
  installationId: string,
  slot: string,
  files: File[]
) {
  for (const file of files) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${installationId}/${slot}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: false });
    if (upErr) throw upErr;
    const { error: imgErr } = await supabase.from("installation_images").insert({
      installation_id: installationId,
      slot,
      storage_path: path,
    });
    if (imgErr) throw imgErr;
  }
}

export function InstallationForm({
  mode,
  installation,
  sitePhotos = [],
  acceptanceForms = [],
}: Props) {
  const router = useRouter();

  const initial: FormValues = {};
  for (const f of CUSTOMER_FIELDS) {
    initial[f.key] = (installation?.[f.key as keyof Installation] as string) ?? "";
  }
  initial.status = installation?.status ?? "Pending";

  const [values, setValues] = useState<FormValues>(initial);
  const [pendingSitePhotos, setPendingSitePhotos] = useState<File[]>([]);
  const [pendingAcceptance, setPendingAcceptance] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = { status: values.status };
    for (const f of CUSTOMER_FIELDS) {
      const raw = values[f.key]?.trim();
      payload[f.key] = raw === "" ? null : raw;
    }
    return payload;
  }

  function validate(): string | null {
    const missing = CUSTOMER_FIELDS.filter((f) => !values[f.key]?.trim()).map((f) => f.label);
    if (missing.length > 0) {
      return `Please fill in all fields. Missing: ${missing.join(", ")}.`;
    }
    if (!values.status?.trim()) {
      return "Status is required.";
    }
    if (sitePhotos.length + pendingSitePhotos.length === 0) {
      return "Add at least one site photo.";
    }
    if (acceptanceForms.length + pendingAcceptance.length === 0) {
      return "Add at least one acceptance form photo.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      if (mode === "create") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: row, error: insErr } = await supabase
          .from("installations")
          .insert({ ...toPayload(), created_by: user.id })
          .select("id")
          .single();
        if (insErr) throw insErr;

        const installationId = row.id as string;
        await uploadFiles(supabase, installationId, SITE_PHOTOS_SLOT, pendingSitePhotos);
        await uploadFiles(supabase, installationId, ACCEPTANCE_FORM_SLOT, pendingAcceptance);

        router.push(`/installations/${installationId}`);
        router.refresh();
      } else if (installation) {
        const { error: updErr } = await supabase
          .from("installations")
          .update(toPayload())
          .eq("id", installation.id);
        if (updErr) throw updErr;

        router.push(`/installations/${installation.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CUSTOMER_FIELDS.map((f) => (
              <div
                key={f.key}
                className={f.span === 2 ? "sm:col-span-2 lg:col-span-3" : ""}
              >
                <Label htmlFor={f.key} className="mb-1.5 block">
                  {f.label}
                  <span className="text-destructive"> *</span>
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={f.key}
                    value={values[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                ) : (
                  <Input
                    id={f.key}
                    type={f.type === "date" ? "date" : "text"}
                    value={values[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                )}
              </div>
            ))}
            <div>
              <Label htmlFor="status" className="mb-1.5 block">
                Status
                <span className="text-destructive"> *</span>
              </Label>
              <Select
                id="status"
                value={values.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                {INSTALLATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            All fields are required. You can edit the entry again after saving.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Site Photos <span className="text-destructive">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUploader
            mode={mode}
            installationId={installation?.id}
            slot={SITE_PHOTOS_SLOT}
            existing={sitePhotos}
            hint="Use Choose from device to pick multiple photos from your gallery, or Take photo for the camera."
            onPendingChange={setPendingSitePhotos}
          />
          {mode === "create" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Photos are uploaded when you save the entry. At least one site photo is required.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Acceptance Form <span className="text-destructive">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUploader
            mode={mode}
            installationId={installation?.id}
            slot={ACCEPTANCE_FORM_SLOT}
            existing={acceptanceForms}
            hint="Use Choose from device for gallery photos, or Take photo for the camera."
            onPendingChange={setPendingAcceptance}
          />
          {mode === "create" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Photos are uploaded when you save the entry. At least one acceptance form photo is
              required.
            </p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {mode === "create" ? "Create entry" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
