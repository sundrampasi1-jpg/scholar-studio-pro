import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  const list = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${user!.id},user_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const unreadMine = (list.data ?? []).filter((n) => !n.is_read && n.user_id === user?.id).map((n) => n.id);

  return (
    <StudentShell
      title="Notifications"
      actions={
        <Button size="sm" variant="outline" disabled={unreadMine.length === 0} onClick={() => markRead.mutate(unreadMine)}>
          Mark all as read
        </Button>
      }
    >
      {list.isLoading ? (
        <LoadingState />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState title="You're all caught up" />
      ) : (
        <div className="space-y-2">
          {(list.data ?? []).map((n) => {
            const unread = !n.is_read && n.user_id === user?.id;
            return (
              <button
                key={n.id}
                onClick={() => unread && markRead.mutate([n.id])}
                className={cn(
                  "surface-card block w-full p-4 text-left",
                  unread && "border-l-4 border-l-primary",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("text-sm", unread && "font-semibold")}>{n.title}</p>
                  <span className="text-[11px] uppercase text-muted-foreground">{n.type}</span>
                </div>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </button>
            );
          })}
        </div>
      )}
    </StudentShell>
  );
}
