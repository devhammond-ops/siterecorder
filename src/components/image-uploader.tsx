"use client";

import { useRef, useState } from "react";
import { Camera, Trash2, Upload, Loader2, Images } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKET } from "@/lib/constants";
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
  /** DB slot key (e.g. photo, acceptance_form). */
  slot: string;
  existing?: SlotImage[];
  hint?: string;
  /** create-mode: report buffered files upward. */
  onPendingChange?: (files: File[]) => void;
}

/** Prefer gallery/files; avoid image/* alone which some Androids treat as capture. */
const GALLERY_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic";

export function ImageUploader({
  mode,
  installationId,
  slot,
  existing = [],
  hint = "Choose photos from your device or take new ones with the camera.",
  onPendingChange,
}: Props) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<SlotImage[]>(existing);
  const [pending, setPending] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)
    );
    if (list.length === 0) {
      setError("Please select image files only.");
      return;
    }

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
        const path = `${installationId}/${slot}-${Date.now()}-${Math.random()
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
            slot,
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
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
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

  const actionButtons = (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => galleryRef.current?.click()}
        disabled={busy}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
        Choose from device
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => cameraRef.current?.click()}
        disabled={busy}
      >
        <Camera className="h-4 w-4" />
        Take photo
      </Button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <p className="text-sm text-muted-foreground">{hint}</p>
        {actionButtons}
      </div>

      {/* Gallery / files — no capture attribute (multi-select). */}
      <input
        ref={galleryRef}
        type="file"
        accept={GALLERY_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {/* Camera — capture only when user taps Take photo. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
          >
            {img.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.url} alt="" className="h-full w-full object-cover" />
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
          <div className="col-span-2 flex aspect-[2/1] flex-col items-center justify-center gap-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground sm:col-span-3 md:col-span-4 lg:col-span-5">
            <Upload className="h-6 w-6" />
            <p className="text-center">No photos yet</p>
            {actionButtons}
          </div>
        )}
      </div>
    </div>
  );
}
