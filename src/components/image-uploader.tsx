"use client";

import { useRef, useState } from "react";
import { Trash2, Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_IMAGE_SLOT, STORAGE_BUCKET } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export interface SlotImage {
  id: string;
  path: string;
  url: string;
}

interface Props {
  /** create = buffer files in parent; edit = upload immediately. */
  mode: "create" | "edit";
  installationId?: string;
  existing?: SlotImage[];
  /** create-mode: report buffered files upward. */
  onPendingChange?: (files: File[]) => void;
}

export function ImageUploader({
  mode,
  installationId,
  existing = [],
  onPendingChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<SlotImage[]>(existing);
  const [pending, setPending] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files);

    if (mode === "create") {
      const next = [
        ...pending,
        ...list.map((file) => ({ file, preview: URL.createObjectURL(file) })),
      ];
      setPending(next);
      onPendingChange?.(next.map((p) => p.file));
      return;
    }

    if (!installationId) return;
    setBusy(true);
    const supabase = createClient();
    try {
      for (const file of list) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${installationId}/${DEFAULT_IMAGE_SLOT}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;

        const { data: row, error: insErr } = await supabase
          .from("installation_images")
          .insert({
            installation_id: installationId,
            slot: DEFAULT_IMAGE_SLOT,
            storage_path: path,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        const { data: signed } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(path, 3600);

        setImages((prev) => [
          ...prev,
          { id: row.id, path, url: signed?.signedUrl ?? "" },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteExisting(img: SlotImage) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([img.path]);
      await supabase.from("installation_images").delete().eq("id", img.id);
      setImages((prev) => prev.filter((i) => i.id !== img.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function removePending(index: number) {
    const next = pending.filter((_, i) => i !== index);
    setPending(next);
    onPendingChange?.(next.map((p) => p.file));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Upload all site photos together. You can add or remove photos anytime.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Add photos
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
          >
            {img.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.url} alt="Evidence" className="h-full w-full object-cover" />
            ) : null}
            <button
              type="button"
              onClick={() => deleteExisting(img)}
              className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {pending.map((p, i) => (
          <div
            key={`pending-${i}`}
            className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="Pending upload" className="h-full w-full object-cover opacity-70" />
            <button
              type="button"
              onClick={() => removePending(i)}
              className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
              pending
            </span>
          </div>
        ))}

        {images.length === 0 && pending.length === 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="col-span-2 flex aspect-[2/1] flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-muted/50 sm:col-span-3 md:col-span-4 lg:col-span-5"
          >
            <Upload className="h-6 w-6" />
            Tap to select photos
          </button>
        )}
      </div>
    </div>
  );
}
