"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cable, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/auth";

function buildLinks(user: CurrentUser) {
  const links = [
    { href: "/", label: "Installations" },
    { href: "/profile", label: "Profile" },
    { href: "/expenses", label: "Expenses" },
  ];
  if (user.canManageHsq) {
    links.push({ href: "/hsq", label: "HSQ Reports" });
  }
  if (user.isAdmin) {
    links.push(
      { href: "/admin/schedules", label: "Reports" },
      { href: "/admin/users", label: "Users" }
    );
  }
  return links;
}

function linkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = buildLinks(user);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
          <Cable className="h-5 w-5 shrink-0 text-primary" />
          <span className="hidden sm:inline">Cable Install Recorder</span>
          <span className="sm:hidden">Recorder</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-sm lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground",
                linkActive(pathname, link.href) && "bg-accent font-medium text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 text-sm lg:flex">
            <span className="max-w-[160px] truncate text-muted-foreground">
              {user.profile?.full_name || user.email}
            </span>
            <Badge className="border-primary/20 bg-primary/10 text-primary">{user.role}</Badge>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit" title="Sign out">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>

          {/* Mobile menu trigger */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            Menu
          </Button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 top-14 z-20 bg-black/30 lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav-menu"
            className="absolute inset-x-0 top-14 z-30 border-b bg-background shadow-lg lg:hidden"
          >
            <div className="mx-auto max-w-7xl px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                <span className="truncate font-medium">
                  {user.profile?.full_name || user.email}
                </span>
                <Badge className="shrink-0 border-primary/20 bg-primary/10 text-primary">
                  {user.role}
                </Badge>
              </div>
              <nav className="flex flex-col gap-1">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                      linkActive(pathname, link.href) &&
                        "bg-accent font-medium text-foreground"
                    )}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <form action="/auth/signout" method="post" className="mt-3 border-t pt-3">
                <Button variant="ghost" size="sm" type="submit" className="w-full justify-start">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
