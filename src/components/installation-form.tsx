"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CUSTOMER_FIELDS,
  IMAGE_SLOTS,
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
import { ImageSlotUploader, type SlotImage } from "@/components/image-slot-uploader";

interface Props {
  mode: "create" | "edit";
  installation?: Installation;
  imagesBySlot?: Record<string, SlotImage[]>;
}

type FormValues = Record<string, string>;

export function InstallationForm({ mode, installation, imagesBySlot = {} }: Props) {
  const router = useRouter();

  const initial: FormValues = {};
  for (const f of CUSTOMER_FIELDS) {
    initial[f.key] = (installation?.[f.key as keyof Installation] as string) ?? "";
  }
  initial.status = installation?.status ?? "Pending";

  const [values, setValues] = useState<FormValues>(initial);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!values.customer_name?.trim() || !values.order_number?.trim()) {
      setError("Customer Name and Order Number are required.");
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

        for (const [slot, files] of Object.entries(pendingFiles)) {
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
    <form onSubmit={handleSubmit} className="space-y-6">
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
                  {f.required && <span className="text-destructive"> *</span>}
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
                    required={f.required}
                  />
                )}
              </div>
            ))}
            <div>
              <Label htmlFor="status" className="mb-1.5 block">
                Status
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Image Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {IMAGE_SLOTS.map((slot) => (
              <ImageSlotUploader
                key={slot.key}
                slot={slot}
                mode={mode}
                installationId={installation?.id}
                existing={imagesBySlot[slot.key] ?? []}
                onPendingChange={(slotKey, files) =>
                  setPendingFiles((prev) => ({ ...prev, [slotKey]: files }))
                }
              />
            ))}
          </div>
          {mode === "create" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Photos are uploaded when you save the entry.
            </p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={saving}
        >
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
