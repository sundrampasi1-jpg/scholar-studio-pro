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
  CreditCard,
  MessageCircle,
  BarChart3,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

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

            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Open profile menu"
                  className="h-10 w-10 rounded-xl"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(88vw,380px)] max-w-[88vw] overflow-y-auto border-l border-border bg-card px-5 pb-8 pt-10">
                <div className="mb-6 flex items-center gap-4 border-b border-border pb-6 pr-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-primary">
                    <User className="h-8 w-8" />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-left text-lg">{user?.user_metadata?.full_name || user?.user_metadata?.name || "My Account"}</SheetTitle>
                    <SheetDescription className="mt-1 break-all text-left">{user?.email || "JK Academy account"}</SheetDescription>
                  </div>
                </div>
                <nav className="space-y-1" aria-label="Account menu">
                  <SheetClose asChild><Link to="/profile" className="flex min-h-14 items-center gap-4 rounded-xl px-3 text-[15px] font-semibold transition-colors hover:bg-accent"><User className="h-5 w-5 shrink-0" />My Profile<span className="ml-auto text-muted-foreground">›</span></Link></SheetClose>
                  <SheetClose asChild><Link to="/settings" className="flex min-h-14 items-center gap-4 rounded-xl px-3 text-[15px] font-semibold transition-colors hover:bg-accent"><Settings className="h-5 w-5 shrink-0" />Settings<span className="ml-auto text-muted-foreground">›</span></Link></SheetClose>
                  <SheetClose asChild><Link to="/payments" className="flex min-h-14 items-center gap-4 rounded-xl px-3 text-[15px] font-semibold transition-colors hover:bg-accent"><CreditCard className="h-5 w-5 shrink-0" />My Payments<span className="ml-auto text-muted-foreground">›</span></Link></SheetClose>
                  <SheetClose asChild><Link to="/help" className="flex min-h-14 items-center gap-4 rounded-xl px-3 text-[15px] font-semibold transition-colors hover:bg-accent"><MessageCircle className="h-5 w-5 shrink-0" />Help &amp; Chat<span className="ml-auto text-muted-foreground">›</span></Link></SheetClose>
                  <SheetClose asChild><Link to="/my-reports" className="flex min-h-14 items-center gap-4 rounded-xl px-3 text-[15px] font-semibold transition-colors hover:bg-accent"><BarChart3 className="h-5 w-5 shrink-0" />My Reports<span className="ml-auto text-muted-foreground">›</span></Link></SheetClose>
                  {isStaff && <SheetClose asChild><Link to="/admin" className="flex min-h-14 items-center gap-4 rounded-xl px-3 text-[15px] font-semibold transition-colors hover:bg-accent"><ShieldCheck className="h-5 w-5 shrink-0" />{isAdmin ? "Admin Panel" : "Teacher Panel"}<span className="ml-auto text-muted-foreground">›</span></Link></SheetClose>}
                </nav>
                <div className="my-5 border-t border-border" />
                <Button variant="ghost" className="h-14 w-full justify-start gap-4 rounded-xl px-3 text-base font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={signOut}>
                  <LogOut className="h-5 w-5" />Log Out
                </Button>
              </SheetContent>
            </Sheet>ropdownMenu>
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
