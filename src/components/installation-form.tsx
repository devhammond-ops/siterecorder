"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CUSTOMER_FIELDS,
  DEFAULT_IMAGE_SLOT,
  DRAFT_STATUS,
  INSTALLATION_STATUSES,
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
  images?: SlotImage[];
}

type FormValues = Record<string, string>;
type SaveIntent = "draft" | "complete";

export function InstallationForm({ mode, installation, images = [] }: Props) {
  const router = useRouter();

  const initial: FormValues = {};
  for (const f of CUSTOMER_FIELDS) {
    initial[f.key] = (installation?.[f.key as keyof Installation] as string) ?? "";
  }
  initial.status = installation?.status ?? DRAFT_STATUS;

  const [values, setValues] = useState<FormValues>(initial);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState<SaveIntent | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toPayload(intent: SaveIntent): Record<string, unknown> {
    const status =
      intent === "draft"
        ? DRAFT_STATUS
        : values.status === DRAFT_STATUS
          ? "Pending"
          : values.status;

    const payload: Record<string, unknown> = { status };
    for (const f of CUSTOMER_FIELDS) {
      const raw = values[f.key]?.trim();
      if (intent === "draft") {
        // DB requires these two columns non-null
        if (f.key === "customer_name") {
          payload[f.key] = raw || "(Draft)";
        } else if (f.key === "order_number") {
          payload[f.key] = raw || "DRAFT";
        } else {
          payload[f.key] = raw === "" ? null : raw;
        }
      } else {
        payload[f.key] = raw === "" ? null : raw;
      }
    }
    return payload;
  }

  function validateComplete(): string | null {
    const missing = CUSTOMER_FIELDS.filter((f) => !values[f.key]?.trim()).map((f) => f.label);
    if (missing.length > 0) {
      return `Please fill in all fields before saving. Missing: ${missing.join(", ")}.`;
    }
    if (!values.status?.trim() || values.status === DRAFT_STATUS) {
      return "Choose a status other than Draft when submitting a complete entry.";
    }
    const photoCount = images.length + pendingFiles.length;
    if (photoCount === 0) {
      return "Add at least one site photo before submitting a complete entry.";
    }
    return null;
  }

  async function save(intent: SaveIntent) {
    setError(null);

    if (intent === "complete") {
      const validationError = validateComplete();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setSaving(intent);
    const supabase = createClient();

    try {
      if (mode === "create") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: row, error: insErr } = await supabase
          .from("installations")
          .insert({ ...toPayload(intent), created_by: user.id })
          .select("id")
          .single();
        if (insErr) throw insErr;

        const installationId = row.id as string;

        for (const file of pendingFiles) {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${installationId}/${DEFAULT_IMAGE_SLOT}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, file, { upsert: false });
          if (upErr) throw upErr;
          const { error: imgErr } = await supabase.from("installation_images").insert({
            installation_id: installationId,
            slot: DEFAULT_IMAGE_SLOT,
            storage_path: path,
          });
          if (imgErr) throw imgErr;
        }

        router.push(`/installations/${installationId}`);
        router.refresh();
      } else if (installation) {
        const { error: updErr } = await supabase
          .from("installations")
          .update(toPayload(intent))
          .eq("id", installation.id);
        if (updErr) throw updErr;

        router.push(`/installations/${installation.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(null);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save("complete");
      }}
      className="space-y-6"
      noValidate
    >
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
            All fields are required for a complete entry. Use <strong>Save as draft</strong> to
            keep partial work.
          </p>
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
            existing={images}
            onPendingChange={setPendingFiles}
          />
          {mode === "create" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Photos are uploaded when you save the entry. At least one photo is required for a
              complete entry.
            </p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={!!saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!!saving}
          onClick={() => void save("draft")}
        >
          {saving === "draft" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Save as draft
        </Button>
        <Button type="submit" disabled={!!saving}>
          {saving === "complete" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {mode === "create" ? "Create entry" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
