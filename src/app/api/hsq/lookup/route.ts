import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupHsqSiteWorkers } from "@/lib/hsq";
import type { UserRole } from "@/lib/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile?.role as UserRole) ?? "technician";
  if (role !== "admin" && role !== "team_leader") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const siteId = request.nextUrl.searchParams.get("site_id")?.trim() ?? "";
  const reportDate = request.nextUrl.searchParams.get("date")?.trim() ?? "";

  if (!siteId || !reportDate) {
    return NextResponse.json(
      { error: "site_id and date are required" },
      { status: 400 }
    );
  }

  const result = await lookupHsqSiteWorkers(siteId, reportDate);
  return NextResponse.json(result);
}
