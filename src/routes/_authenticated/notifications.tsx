 import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
.or("user_id.eq.${user!.id},user_id.is.null")
.order("created_at", { ascending: false })
.limit(100);

  if (error) throw error;
  return data;
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
.filter((n) => !n.is_read && n.user_id === user?.id)
.map((n) => n.id);

return (
<StudentShell
title="Notifications"
actions={
<Button
size="sm"
variant="outline"
disabled={!unreadMine.length || markRead.isPending}
onClick={() => markRead.mutate(unreadMine)}
>
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
<div className="space-y-2">
{(list.data ?? []).map((n) => {
const unread = !n.is_read && n.user_id === user?.id;
const canDelete = !!user && n.user_id === user.id;

        return (
          <div
            key={n.id}
            className={cn(
              "surface-card flex items-start gap-3 p-4",
              unread && "border-l-4 border-l-primary",
            )}
          >
            <button
              type="button"
              onClick={() => unread && markRead.mutate([n.id])}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className={cn("text-sm", unread && "font-semibold")}>
                  {n.title}
                </p>
                <span className="text-[11px] uppercase text-muted-foreground">
                  {n.type}
                </span>
              </div>
              {n.body && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {n.body}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatDateTime(n.created_at)}
              </p>
            </button>

            {canDelete && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Delete notification"
                title="Delete notification"
                disabled={deleteNotification.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "क्या आप इस notification को delete करना चाहते हैं?"
                    )
                  ) {
                    deleteNotification.mutate(n.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  )}
</StudentShell>

);
  }
