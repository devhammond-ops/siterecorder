"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { INSTALLATION_STATUSES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const status = searchParams.get("status") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    startTransition(() => router.push(`/?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        className="relative flex-1 min-w-[200px]"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search name, order #, MSISDN, address..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => apply({ q })}
        />
      </form>

      <div className="w-40">
        <Select value={status} onChange={(e) => apply({ status: e.target.value })}>
          <option value="">All statuses</option>
          {INSTALLATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          className="w-40"
          value={from}
          title="Installed from"
          onChange={(e) => apply({ from: e.target.value })}
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="date"
          className="w-40"
          value={to}
          title="Installed to"
          onChange={(e) => apply({ to: e.target.value })}
        />
      </div>
    </div>
  );
}
