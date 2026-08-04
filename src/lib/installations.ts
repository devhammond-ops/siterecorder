import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/constants";
import type { Installation, InstallationImage } from "@/lib/types";
import type { SlotImage } from "@/components/image-slot-uploader";

export interface InstallationWithImages {
  installation: Installation;
  imagesBySlot: Record<string, SlotImage[]>;
  totalImages: number;
}

export async function getInstallationWithImages(
  id: string
): Promise<InstallationWithImages | null> {
  const supabase = await createClient();

  const { data: installation } = await supabase
    .from("installations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!installation) return null;

  const { data: images } = await supabase
    .from("installation_images")
    .select("*")
    .eq("installation_id", id)
    .order("created_at", { ascending: true });

  const imageRows = (images ?? []) as InstallationImage[];
  const imagesBySlot: Record<string, SlotImage[]> = {};

  if (imageRows.length > 0) {
    const paths = imageRows.map((r) => r.storage_path);
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(paths, 3600);

    const urlByPath = new Map<string, string>();
    (signed ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    });

    for (const row of imageRows) {
      const slotImg: SlotImage = {
        id: row.id,
        path: row.storage_path,
        url: urlByPath.get(row.storage_path) ?? "",
      };
      (imagesBySlot[row.slot] ??= []).push(slotImg);
    }
  }

  return {
    installation: installation as Installation,
    imagesBySlot,
    totalImages: imageRows.length,
  };
}
