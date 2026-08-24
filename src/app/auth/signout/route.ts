import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Public origin behind Infomaniak / reverse proxies (avoids localhost redirects). */
function publicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  if (host) {
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host.split(",")[0].trim()}`;
  }
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", publicOrigin(request)), {
    status: 302,
  });
}
