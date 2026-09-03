"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/select";
import type { UserRole } from "@/lib/types";

export function UserRoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: UserRole;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<UserRole>(role);
  const [saving, setSaving] = useState(false);

  async function change(next: UserRole) {
    setSaving(true);
    const supabase = createClient();
    const prev = value;
    setValue(next);
    const { error } = await supabase
      .from("profiles")
      .update({ role: next })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setValue(prev);
      alert(error.message);
    } else {
      router.refresh();
    }
  }

  return (
    <Select
      className="h-9 w-36"
      value={value}
      disabled={disabled || saving}
      onChange={(e) => change(e.target.value as UserRole)}
    >
      <option value="technician">technician</option>
      <option value="team_leader">team_leader</option>
      <option value="admin">admin</option>
    </Select>
  );
}
