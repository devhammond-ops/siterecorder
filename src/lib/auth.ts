import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

export interface CurrentUser {
  id: string;
  email: string | null;
  profile: Profile | null;
  role: UserRole;
  isAdmin: boolean;
}

/**
 * Returns the authenticated user + profile, or redirects to /login.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const role: UserRole = (profile?.role as UserRole) ?? "technician";

  return {
    id: user.id,
    email: user.email ?? null,
    profile: (profile as Profile) ?? null,
    role,
    isAdmin: role === "admin",
  };
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) {
    redirect("/");
  }
  return user;
}
