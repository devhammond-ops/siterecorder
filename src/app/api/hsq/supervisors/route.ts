import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["admin", "team_leader"])
    .order("full_name", { ascending: true });

  return NextResponse.json(
    (data ?? []).map((a) => ({
      id: a.id,
      full_name: a.full_name ?? "(no name)",
      role: a.role,
      signature: profileSignature(a.full_name),
    }))
  );
}
