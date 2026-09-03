import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupervisorOptions } from "@/lib/hsq";
import { profileSignature } from "@/lib/profile";
import type { UserRole } from "@/lib/types";

export async function GET() {
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

  const admins = await getSupervisorOptions();
  return NextResponse.json(
    admins.map((a) => ({
      id: a.id,
      full_name: a.full_name ?? "(no name)",
      signature: profileSignature(a.full_name),
    }))
  );
}
