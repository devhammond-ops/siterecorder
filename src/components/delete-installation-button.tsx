"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKET } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export function DeleteInstallationButton({
  installationId,
  imagePaths,
}: {
  installationId: string;
  imagePaths: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this installation and all its photos? This cannot be undone.")) {
      return;
    }
    setBusy(true);
    const supabase = createClient();
    try {
      if (imagePaths.length > 0) {
        await supabase.storage.from(STORAGE_BUCKET).remove(imagePaths);
      }
      // installation_images rows cascade-delete with the installation.
      const { error } = await supabase.from("installations").delete().eq("id", installationId);
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
      setBusy(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Delete
    </Button>
  );
}
