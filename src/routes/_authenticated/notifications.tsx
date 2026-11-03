
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  Radio,
  Megaphone,
  GraduationCap,
  Sparkles,
  Trash2,
  CheckCheck,
} from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — JK Academy" },
      { name: "description", content: "Your notifications and updates." },
      { property: "og:title", content: "Notifications — JK Academy" },
      { property: "og:description", content: "Your notifications and updates." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});

  const list = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data ?? [];
    },
  });

  const refreshNotifications = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["notifications"] }),
      qc.invalidateQueries({ queryKey: ["unread-notifications"] }),
    ]);
  };

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length || !user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", ids)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: refreshNotifications,
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Please sign in again.");

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: refreshNotifications,
  });

  const unreadMine = (list.data ?? [])
    .filter((n) => !n.is_read)
    .map((n) => n.id);

  function getIcon(type: string) {
    const value = type.toLowerCase();

    if (value.includes("announcement")) return Megaphone;
    if (value.includes("course")) return BookOpen;
    if (value.includes("lesson")) return GraduationCap;
    if (value.includes("live")) return Radio;
    return Bell;
  }

  function handleTouchStart(e: React.TouchEvent, id: string) {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchMove(e: React.TouchEvent, id: string) {
    if (!touchStart.current || deleteNotification.isPending) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;

    if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
      setSwipeOffsets((old) => ({
        ...old,
        [id]: Math.max(dx, -120),
      }));
    }
  }

  function handleTouchEnd(id: string) {
    const offset = swipeOffsets[id] ?? 0;
    touchStart.current = null;

    if (offset <= -85) {
      deleteNotification.mutate(id);
      setSwipeOffsets((old) => {
        const next = { ...old };
        delete next[id];
        return next;
      });
    } else {
      setSwipeOffsets((old) => ({ ...old, [id]: 0 }));
    }
  }

  return (
    <StudentShell
      title="Notifications"
      actions={
        <Button
          size="sm"
          variant="outline"
          className="rounded-full gap-1.5"
          disabled={!unreadMine.length || markRead.isPending}
          onClick={() => markRead.mutate(unreadMine)}
        >
          <CheckCheck className="h-4 w-4" />
          Mark all as read
        </Button>
      }
    >
      {list.isLoading ? (
        <LoadingState />
      ) : list.isError ? (
        <EmptyState title="Could not load notifications. Please try again." />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState title="You're all caught up" />
      ) : (
        <div className="space-y-3">
          {(list.data ?? []).map((n) => {
            const unread = !n.is_read;
            const Icon = getIcon(n.type);
            const offset = swipeOffsets[n.id] ?? 0;

            return (
              <div
                key={n.id}
                className="relative overflow-hidden rounded-2xl"
                onTouchStart={(e) => handleTouchStart(e, n.id)}
                onTouchMove={(e) => handleTouchMove(e, n.id)}
                onTouchEnd={() => handleTouchEnd(n.id)}
                onTouchCancel={() => {
                  touchStart.current = null;
                  setSwipeOffsets((old) => ({ ...old, [n.id]: 0 }));
                }}
                style={{ touchAction: "pan-y" }}
              >
                <div className="absolute inset-0 flex items-center justify-end bg-red-600 pr-6 text-white">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Trash2 className="h-5 w-5" />
                    Delete
                  </div>
                </div>

                <div
                  className={cn(
                    "relative flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition-transform duration-200",
                    unread
                      ? "border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card"
                      : "border-border/70 bg-card",
                  )}
                  style={{ transform: `translateX(${offset}px)` }}
                >
                  <button
                    type="button"
                    onClick={() => unread && markRead.mutate([n.id])}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    aria-label={`Open notification: ${n.title}`}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                        unread
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "min-w-0 flex-1 text-sm leading-5",
                            unread ? "font-bold text-foreground" : "font-medium",
                          )}
                        >
                          {n.title}
                        </p>

                        {unread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
                        )}
                      </div>

                      {n.body && (
                        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                          {n.body}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {n.type}
                        </span>

                        <span className="text-[11px] text-muted-foreground">
                          {formatDateTime(n.created_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(list.data ?? []).length > 0 && (
        <div className="flex items-center justify-center gap-2 pt-3 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Swipe left on a notification to delete it
        </div>
      )}
    </StudentShell>
  );
}
