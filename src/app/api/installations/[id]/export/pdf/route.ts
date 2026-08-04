import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildInstallationPdf, fetchImageBytes } from "@/lib/pdf/installation-pdf";
import type { Installation, InstallationImage } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: installation, error } = await supabase
    .from("installations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!installation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: imageRows } = await supabase
    .from("installation_images")
    .select("*")
    .eq("installation_id", id)
    .order("created_at", { ascending: true });

  const images = await fetchImageBytes(supabase, (imageRows ?? []) as InstallationImage[]);
  const pdfBytes = await buildInstallationPdf(installation as Installation, images);

  const safeName = String(installation.customer_name)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  const filename = `installation-${safeName || id.slice(0, 8)}.pdf`;

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
