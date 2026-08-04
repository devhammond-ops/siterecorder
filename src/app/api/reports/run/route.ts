import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin-only: trigger a one-off (test) run of a report schedule now.
 * Invokes the generate-report Edge Function server-side using the service role
 * key so the key is never exposed to the browser.
 */
export async function POST(request: NextRequest) {
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
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { schedule_id } = await request.json().catch(() => ({}));
  if (!schedule_id) {
    return NextResponse.json({ error: "schedule_id required" }, { status: 400 });
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-report`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ schedule_id, test: true }),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: result?.error || "Edge function failed", detail: result },
      { status: 502 }
    );
  }
  return NextResponse.json(result);
}
