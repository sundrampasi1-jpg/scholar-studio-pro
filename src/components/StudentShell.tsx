import {
  Link,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
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
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

function insideHorizontalScroller(
  node: HTMLElement | null,
  stop: HTMLElement,
) {
  let current = node;

  while (current && current !== stop) {
    const style = window.getComputedStyle(current);

    if (
      (style.overflowX === "auto" ||
        style.overflowX === "scroll") &&
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
  const suppressClickUntilRef = useRef(0);
  const [swipeDrag, setSwipeDrag] = useState(0);

  const activeTabIndex = navItems.findIndex(
    (item) => item.to === location.pathname,
  );

  useEffect(() => {
    navItems.forEach((item) => {
      void router.preloadRoute({ to: item.to }).catch(() => {
        // Normal navigation remains available if preload fails.
      });
    });
  }, [router]);

  useEffect(() => {
    setSwipeDrag(0);

    if (activeTabIndex < 0) return;

    const el = mainRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let dx = 0;
    let tracking = false;
    let horizontal = false;
    let startTarget: HTMLElement | null = null;

    const reset = () => {
      tracking = false;
      horizontal = false;
      dx = 0;
      startTarget = null;
      setSwipeDrag(0);
    };

    const onTouchStart = (event: TouchEvent) => {
      reset();

      if (event.touches.length !== 1) return;

      const target =
        event.target instanceof HTMLElement
          ? event.target
          : null;

      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], ' +
            '[role="slider"], [data-no-tab-swipe]',
        )
      ) {
        return;
      }

      if (insideHorizontalScroller(target, el)) return;

      const touch = event.touches[0];
      if (!touch) return;

      startX = touch.clientX;
      startY = touch.clientY;
      startTime = performance.now();
      startTarget = target;
      tracking = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking) return;

      if (event.touches.length !== 1) {
        reset();
        return;
      }

      const touch = event.touches[0];
      if (!touch) return;

      dx = touch.clientX - startX;

      const dy = touch.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (!horizontal) {
        if (Math.max(absX, absY) < 12) return;

        // Preserve normal vertical scrolling.
        if (absY >= absX) {
          reset();
          return;
        }

        if (absX <= absY * 1.2) return;

        if (insideHorizontalScroller(startTarget, el)) {
          reset();
          return;
        }

        horizontal = true;
      }

      // Prevent an accidental click after dragging.
      suppressClickUntilRef.current = performance.now() + 400;

      if (event.cancelable) {
        event.preventDefault();
      }

      setSwipeDrag(
        Math.max(-100, Math.min(100, dx * 0.45)),
      );
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) return;

      const touch = event.changedTouches[0];

      if (touch) {
        dx = touch.clientX - startX;
      }

      const elapsed = Math.max(
        performance.now() - startTime,
        1,
      );
      const distance = Math.abs(dx);
      const velocity = distance / elapsed;

      const shouldNavigate =
        horizontal &&
        (distance >= 60 ||
          (distance >= 30 && velocity >= 0.45));

      if (horizontal) {
        suppressClickUntilRef.current =
          performance.now() + 400;
      }

      if (!shouldNavigate) {
        reset();
        return;
      }

      // Finger left -> previous tab.
      // Finger right -> next tab.
      // Reels: left -> Notes, right -> Home.
      const direction = dx < 0 ? -1 : 1;
      const nextIndex =
        (activeTabIndex + direction + navItems.length) %
        navItems.length;

      const nextItem = navItems[nextIndex];

      reset();

      if (nextItem) {
        void navigate({ to: nextItem.to });
      }
    };

    const onTouchCancel = () => {
      if (horizontal) {
        suppressClickUntilRef.current =
          performance.now() + 400;
      }

      reset();
    };

    el.addEventListener("touchstart", onTouchStart, {
      passive: true,
    });
    el.addEventListener("touchmove", onTouchMove, {
      passive: false,
    });
    el.addEventListener("touchend", onTouchEnd, {
      passive: true,
    });
    el.addEventListener("touchcancel", onTouchCancel, {
      passive: true,
    });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
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
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen min-h-[100dvh] overflow-x-clip bg-surface pb-20 md:pb-0">
      <header className="fixed left-0 right-0 top-0 z-30 border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link
            to="/dashboard"
            preload="intent"
            preloadDelay={0}
            className="touch-manipulation"
          >
            <Brand compact />
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {navItems.map(({ to, label, Icon }) => (
              <Link
                key={to}
                to={to}
                preload="intent"
                preloadDelay={0}
                activeOptions={{ exact: true }}
                activeProps={{
                  className:
                    "bg-accent text-accent-foreground",
                }}
                className="touch-manipulation rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/settings"
              preload="intent"
              preloadDelay={0}
              aria-label="Settings"
              title="Settings"
              className="touch-manipulation rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Settings className="h-5 w-5" />
            </Link>

            <Link
              to="/notifications"
              preload="intent"
              preloadDelay={0}
              aria-label="Notifications"
              className="relative touch-manipulation rounded-md p-2 hover:bg-accent"
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
                  variant="ghost"
                  size="icon"
                  aria-label="Account"
                  className="touch-manipulation"
                >
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-56"
              >
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {user?.email}
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link
                    to="/profile"
                    preload="intent"
                    preloadDelay={0}
                    className="touch-manipulation"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    to="/settings"
                    preload="intent"
                    preloadDelay={0}
                    className="touch-manipulation"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    to="/payments"
                    preload="intent"
                    preloadDelay={0}
                    className="touch-manipulation"
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Payments
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    to="/help"
                    preload="intent"
                    preloadDelay={0}
                    className="touch-manipulation"
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Help &amp; chat
                  </Link>
                </DropdownMenuItem>

                {isStaff && (
                  <DropdownMenuItem asChild>
                    <Link
                      to="/admin"
                      preload="intent"
                      preloadDelay={0}
                      className="touch-manipulation"
                    >
                      {isAdmin ? (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      ) : (
                        <Settings className="mr-2 h-4 w-4" />
                      )}

                      {isAdmin
                        ? "Admin panel"
                        : "Teacher panel"}
                    </Link>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={signOut}
                  className="touch-manipulation"
                >
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
        className="mx-auto min-h-[calc(100dvh-5rem)] w-full max-w-6xl px-4 py-6 pt-20 md:min-h-[100dvh]"
        style={{
          transform:
            swipeDrag === 0
              ? undefined
              : `translateX(${swipeDrag}px)`,
          transition:
            swipeDrag === 0
              ? "transform 140ms ease-out"
              : "none",
        }}
        onClickCapture={(event) => {
          if (
            performance.now() <
            suppressClickUntilRef.current
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {(title || actions) && (
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              {title && (
                <h1 className="text-2xl font-semibold">
                  {title}
                </h1>
              )}

              {subtitle && (
                <p className="text-sm text-muted-foreground">
                  {subtitle}
                </p>
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
            preload="intent"
            preloadDelay={0}
            activeOptions={{ exact: true }}
            activeProps={{
              className: "text-primary bg-primary/10",
            }}
            className="flex touch-manipulation flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold leading-tight text-foreground/70 transition-colors"
          >
            <Icon className="h-5 w-5" />

            <span className="whitespace-nowrap">
              {label}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
      }
