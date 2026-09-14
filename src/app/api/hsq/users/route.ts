import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllUserOptions } from "@/lib/hsq";
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

  const users = await getAllUserOptions();
  return NextResponse.json(users);
}
