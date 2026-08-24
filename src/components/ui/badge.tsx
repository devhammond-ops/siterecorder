import * as React from "react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  Good: "bg-green-100 text-green-800 border-green-200",
  "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  Failed: "bg-red-100 text-red-800 border-red-200",
  Rework: "bg-orange-100 text-orange-800 border-orange-200",
};

export function Badge({
  className,
  status,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { status?: string }) {
  const color = status ? statusColors[status] ?? "bg-muted text-muted-foreground border-border" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        color,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
