"use client";

import { useRef, useState } from "react";
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
import { usePersistedState } from "@/lib/form-draft";
import { formatInstallationSaveError } from "@/lib/installations-client";
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

interface StagedUpload {
  path: string;
  slot: string;
}

async function stageFilesToStorage(
  supabase: ReturnType<typeof createClient>,
  installationId: string,
  slot: string,
  files: File[]
): Promise<StagedUpload[]> {
  const staged: StagedUpload[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${installationId}/${slot}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: false });
    if (upErr) throw upErr;
    staged.push({ path, slot });
  }
  return staged;
}

async function removeStagedFiles(
  supabase: ReturnType<typeof createClient>,
  staged: StagedUpload[]
) {
  if (staged.length === 0) return;
  await supabase.storage.from(STORAGE_BUCKET).remove(staged.map((s) => s.path));
}

async function removeInstallationRow(
  supabase: ReturnType<typeof createClient>,
  installationId: string
) {
  await supabase.from("installations").delete().eq("id", installationId);
}

function buildInitialValues(installation?: Installation): FormValues {
  const initial: FormValues = {};
  for (const f of CUSTOMER_FIELDS) {
    initial[f.key] = (installation?.[f.key as keyof Installation] as string) ?? "";
  }
  initial.status = installation?.status ?? "Pending";
  initial.status_comments = installation?.status_comments ?? "";
  initial.comments = installation?.comments ?? "";
  return initial;
}

export function InstallationForm({
  mode,
  installation,
  sitePhotos = [],
  acceptanceForms = [],
}: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const draftKey =
    mode === "create" ? "installation:new" : `installation:${installation?.id ?? "edit"}`;

  const [values, setValues, clearValuesDraft, draftReady] = usePersistedState<FormValues>(
    draftKey,
    buildInitialValues(installation),
    true
  );
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
    payload.status_comments = values.status_comments?.trim() || null;
    payload.comments = values.comments?.trim() || null;
    return payload;
  }

  function validate(): string | null {
    const missing = CUSTOMER_FIELDS.filter(
      (f) => f.required !== false && !values[f.key]?.trim()
    ).map((f) => f.label);
    if (missing.length > 0) {
      return `Please fill in all fields. Missing: ${missing.join(", ")}.`;
    }
    if (!values.status?.trim()) {
      return "Status is required.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;

    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    const supabase = createClient();

    try {
      if (mode === "create") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const installationId = crypto.randomUUID();
        let staged: StagedUpload[] = [];
        let rowInserted = false;

        try {
          staged = [
            ...(await stageFilesToStorage(
              supabase,
              installationId,
              SITE_PHOTOS_SLOT,
              pendingSitePhotos
            )),
            ...(await stageFilesToStorage(
              supabase,
              installationId,
              ACCEPTANCE_FORM_SLOT,
              pendingAcceptance
            )),
          ];

          const { error: insErr } = await supabase.from("installations").insert({
            id: installationId,
            ...toPayload(),
            created_by: user.id,
          });
          if (insErr) throw insErr;
          rowInserted = true;

          for (const item of staged) {
            const { error: imgErr } = await supabase.from("installation_images").insert({
              installation_id: installationId,
              slot: item.slot,
              storage_path: item.path,
            });
            if (imgErr) throw imgErr;
          }

          clearValuesDraft();
          router.push(`/installations/${installationId}`);
          router.refresh();
        } catch (innerErr) {
          if (rowInserted) {
            await removeInstallationRow(supabase, installationId);
          }
          await removeStagedFiles(supabase, staged);
          throw innerErr;
        }
      } else if (installation) {
        const { error: updErr } = await supabase
          .from("installations")
          .update(toPayload())
          .eq("id", installation.id);
        if (updErr) throw updErr;

        clearValuesDraft();
        router.push(`/installations/${installation.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(formatInstallationSaveError(err));
    } finally {
      submittingRef.current = false;
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
                  {f.required !== false && <span className="text-destructive"> *</span>}
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
            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="status_comments" className="mb-1.5 block">
                Status Comments
              </Label>
              <Textarea
                id="status_comments"
                value={values.status_comments}
                onChange={(e) => setField("status_comments", e.target.value)}
                placeholder="Notes about the installation status (e.g. reason for failure, rework details)"
                rows={3}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Required fields are marked with *. MSISDN must be unique. Photos are optional when
            the installation is not yet complete.
            {draftReady ? " Your entries are kept if the page reloads before you save." : null}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="comments" className="mb-1.5 block">
            Comments
          </Label>
          <Textarea
            id="comments"
            value={values.comments}
            onChange={(e) => setField("comments", e.target.value)}
            placeholder="Any additional notes about this installation"
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Site Photos</CardTitle>
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
              Photos are uploaded when you save the entry. You can add them later if the
              installation is not complete yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acceptance Form</CardTitle>
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
              Optional — add when the customer acceptance form is available.
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
