import Link from "next/link";
import { Cable, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CurrentUser } from "@/lib/auth";

export function Nav({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Cable className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">Cable Install Recorder</span>
            <span className="sm:hidden">Recorder</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Installations
            </Link>
            <Link
              href="/profile"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Profile
            </Link>
            {user.isAdmin && (
              <>
                <Link
                  href="/admin/schedules"
                  className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Reports
                </Link>
                <Link
                  href="/admin/users"
                  className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Users
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-sm sm:flex">
            <span className="text-muted-foreground">
              {user.profile?.full_name || user.email}
            </span>
            <Badge className="border-primary/20 bg-primary/10 text-primary">
              {user.role}
            </Badge>
          </div>
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="sm" type="submit" title="Sign out">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
