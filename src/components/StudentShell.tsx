 import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Settings, ShieldCheck, User, Wallet, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/dashboard", label: "Home", emoji: "📊" },
  { to: "/courses", label: "Courses", emoji: "📚" },
  { to: "/reels", label: "Reels", emoji: "🎬" },
  { to: "/live", label: "Live", emoji: "🔴" },
  { to: "/tests", label: "Tests", emoji: "📝" },
  { to: "/notes", label: "Notes", emoji: "📄" },
  { to: "/daily-challenge", label: "Daily", emoji: "🔥" },
] as const;

export function StudentShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
}) {
  const { user, isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      return count ?? 0;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-surface pb-20 md:pb-0">
      <header className="fixed top-0 left-0 right-0 z-30 border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/dashboard">
            <Brand compact />
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-accent text-accent-foreground" }}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.emoji} {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/notifications" className="relative rounded-md p-2 hover:bg-accent">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {unread}
                </span>
              )}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <User className="mr-2 h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/payments">
                    <Wallet className="mr-2 h-4 w-4" /> Payments
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/help">
                    <Phone className="mr-2 h-4 w-4" /> Help & chat
                  </Link>
                </DropdownMenuItem>
                {isStaff && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">
                      {isAdmin ? (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      ) : (
                        <Settings className="mr-2 h-4 w-4" />
                      )}
                      {isAdmin ? "Admin panel" : "Teacher panel"}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pt-20">
        {(title || actions) && (
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              {title && <h1 className="text-2xl font-semibold">{title}</h1>}
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-7 border-t bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeProps={{ className: "text-primary bg-primary/10" }}
            className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold leading-tight text-foreground/70 active:scale-90 transition-transform"
          >
            <span className="text-lg leading-none">{item.emoji}</span>
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
   }
