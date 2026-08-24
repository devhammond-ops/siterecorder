import { createClient } from "@/lib/supabase/server";
import { ACCEPTANCE_FORM_SLOT, SITE_PHOTOS_SLOT, STORAGE_BUCKET } from "@/lib/constants";
import type { Installation, InstallationImage } from "@/lib/types";
import type { SlotImage } from "@/components/image-uploader";

export interface InstallationWithImages {
  installation: Installation;
  sitePhotos: SlotImage[];
  acceptanceForms: SlotImage[];
  /** All images (for delete / PDF). */
  images: SlotImage[];
  totalImages: number;
}

function toSlotImage(
  row: InstallationImage,
  urlByPath: Map<string, string>
): SlotImage {
  return {
    id: row.id,
    path: row.storage_path,
    url: urlByPath.get(row.storage_path) ?? "",
  };
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

  const { data: imageRows } = await supabase
    .from("installation_images")
    .select("*")
    .eq("installation_id", id)
    .order("created_at", { ascending: true });

  const rows = (imageRows ?? []) as InstallationImage[];
  const sitePhotos: SlotImage[] = [];
  const acceptanceForms: SlotImage[] = [];
  const images: SlotImage[] = [];

  if (rows.length > 0) {
    const paths = rows.map((r) => r.storage_path);
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(paths, 3600);

    const urlByPath = new Map<string, string>();
    (signed ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    });

    for (const row of rows) {
      const img = toSlotImage(row, urlByPath);
      images.push(img);
      if (row.slot === ACCEPTANCE_FORM_SLOT) {
        acceptanceForms.push(img);
      } else {
        // SITE_PHOTOS_SLOT and any legacy slots
        sitePhotos.push(img);
      }
    }
  }

  return {
    installation: installation as Installation,
    sitePhotos,
    acceptanceForms,
    images,
    totalImages: rows.length,
  };
}

export { SITE_PHOTOS_SLOT, ACCEPTANCE_FORM_SLOT };
