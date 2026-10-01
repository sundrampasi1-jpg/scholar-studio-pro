import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  FileQuestion,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Radio,
  Users,
  Menu,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const modules = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/courses", label: "Courses, lessons & videos", icon: BookOpen },
  { to: "/admin/notes", label: "PDFs & notes", icon: FileText },
  { to: "/admin/tests", label: "Tests & questions", icon: FileQuestion },
  { to: "/admin/live", label: "Live classes", icon: Radio },
  { to: "/admin/doubts", label: "Doubts", icon: HelpCircle },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: Wallet },
] as const;

export function AdminShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="flex h-16 items-center gap-2 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/admin">
            <Brand compact />
          </Link>
          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
            ADMIN
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/dashboard" className="hidden text-sm text-muted-foreground hover:underline sm:block">
              Student view
            </Link>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 h-4 w-4" /> Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside
          className={cn(
            "fixed inset-y-16 left-0 z-30 w-64 overflow-y-auto border-r bg-card p-3 transition-transform lg:static lg:inset-auto lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <nav className="flex flex-col gap-0.5">
            {modules.map((m) => (
              <Link
                key={m.to}
                to={m.to}
                onClick={() => setOpen(false)}
                activeOptions={{ exact: m.to === "/admin" }}
                activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </Link>
            ))}
          </nav>
          <p className="mt-4 truncate px-3 text-[11px] text-muted-foreground">{user?.email}</p>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
