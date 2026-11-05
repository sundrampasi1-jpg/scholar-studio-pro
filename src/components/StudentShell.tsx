import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  Wallet,
  Phone,
  LayoutDashboard,
  BookOpen,
  Clapperboard,
  RadioTower,
  ClipboardCheck,
  FileText,
  Menu,
  ClipboardList,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  { to: "/dashboard", label: "Home", Icon: LayoutDashboard },
  { to: "/courses", label: "Courses", Icon: BookOpen },
  { to: "/live", label: "Live", Icon: RadioTower },
  { to: "/tests", label: "Tests", Icon: ClipboardCheck },
  { to: "/notes", label: "Notes", Icon: FileText },
  { to: "/reels", label: "Reels", Icon: Clapperboard },
] as const;

function insideHorizontalScroller(node: HTMLElement | null, stop: HTMLElement) {
  let current: HTMLElement | null = node;
  while (current && current !== stop) {
    const style = window.getComputedStyle(current);
    if (
      (style.overflowX === "auto" || style.overflowX === "scroll") &&
      current.scrollWidth > current.clientWidth + 1
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

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
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const [swipeDrag, setSwipeDrag] = useState(0);

  useEffect(() => {
    navItems.forEach((item) => {
      router.preloadRoute({ to: item.to }).catch(() => {});
    });
  }, [router]);

  const activeTabIndex = navItems.findIndex(
    (item) => item.to === location.pathname,
  );

  useEffect(() => {
    if (activeTabIndex < 0) return;
    const el = mainRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let dx = 0;
    let dy = 0;
    let tracking = false;
    let horizontal = false;

    const reset = () => {
      setSwipeDrag(0);
      tracking = false;
      horizontal = false;
      dx = 0;
      dy = 0;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      dx = 0;
      dy = 0;
      tracking = true;
      horizontal = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      dx = touch.clientX - startX;
      dy = touch.clientY - startY;

      if (!horizontal) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) <= Math.abs(dy) * 1.2) {
          tracking = false;
          return;
        }
        if (insideHorizontalScroller(event.target as HTMLElement | null, el)) {
          tracking = false;
          return;
        }
        horizontal = true;
      }

      const lockedEdge = activeTabIndex === 0 && dx > 0;
      const resisted = lockedEdge ? dx * 0.2 : dx;
      setSwipeDrag(Math.max(-160, Math.min(160, resisted)));
      event.preventDefault();
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      const elapsed = Date.now() - startTime;

      if (horizontal && Math.abs(dx) > 70 && elapsed < 800) {
        if (dx < 0) {
          const rawNext = activeTabIndex + 1;
          const nextIndex = rawNext >= navItems.length ? 0 : rawNext;
          const nextItem = navItems[nextIndex];
          if (nextItem) {
            reset();
            navigate({ to: nextItem.to });
            return;
          }
        } else if (dx > 0 && activeTabIndex > 0) {
          const nextItem = navItems[activeTabIndex - 1];
          if (nextItem) {
            reset();
            navigate({ to: nextItem.to });
            return;
          }
        }
      }
      reset();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [activeTabIndex, navigate]);

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
    <div className="flex min-h-screen flex-col bg-surface pb-20 md:pb-0">
      <header className="fixed top-0 left-0 right-0 z-30 border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/dashboard">
            <Brand compact />
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {navItems.map(({ to, label, Icon }) => (
              <Link
                key={to}
                to={to}
                activeProps={{
                  className: "bg-accent text-accent-foreground",
                }}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/notifications"
              aria-label="Notifications"
              title="Notifications"
              className="relative rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {unread}
                </span>
              )}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Open menu"
                  className="h-10 w-10 rounded-xl"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="fixed right-0 top-16 bottom-20 z-[60] w-[min(86vw,360px)] overflow-y-auto rounded-l-3xl rounded-r-none border border-[#E9D8C2] bg-card p-3 shadow-[-14px_0_40px_rgba(40,25,10,0.18)]">
                <DropdownMenuLabel className="truncate px-2 py-3 text-sm font-semibold text-foreground">
                  {user?.email}
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem className="min-h-12 rounded-xl px-3 text-[15px] font-semibold" asChild>
                  <Link to="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link to="/payments">
                    <Wallet className="mr-2 h-4 w-4" />
                    Payments
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link to="/help">
                    <Phone className="mr-2 h-4 w-4" />
                    Help &amp; chat
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link to="/my-reports">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    My Reports
                  </Link>
                </DropdownMenuItem>

                {isStaff && (
                  <>
                    <DropdownMenuSeparator />
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
                  </>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem className="min-h-12 rounded-xl px-3 text-[15px] font-semibold" onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pt-20"
        style={{
          transform: `translateX(${swipeDrag}px)`,
          transition: swipeDrag === 0 ? "transform 180ms ease-out" : "none",
        }}
      >
        {(title || actions) && (
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              {title && <h1 className="text-2xl font-semibold">{title}</h1>}
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {actions}
          </div>
        )}
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-6 border-t bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:hidden">
        {navItems.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            activeProps={{
              className: "text-primary bg-primary/10",
            }}
            className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold leading-tight text-foreground/70 transition-colors"
          >
            <Icon className="h-5 w-5" />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
            }
