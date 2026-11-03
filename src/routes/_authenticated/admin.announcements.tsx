
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { LoadingState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, confirmDelete, notifyAll } from "@/lib/admin-ui";
import { formatDateTime } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — JK Academy Admin" },
      { name: "description", content: "Send announcements to students." },
    ],
  }),
  component: AdminAnnouncements,
});

function AdminAnnouncements() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const list = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  async function post() {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle || !cleanBody || saving) return;

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("announcements")
        .insert({
          title: cleanTitle,
          body: cleanBody,
        })
        .select("id")
        .single();

      if (error) throw error;

      await notifyAll(
        supabase,
        cleanTitle,
        "announcement",
        `/announcements?announcement=${data.id}`,
      );

      setTitle("");
      setBody("");
      await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast.success("Announcement posted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Announcement post failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirmDelete("this announcement")) return;

    const notificationLink = `/announcements?announcement=${id}`;

    const { error: notificationError } = await supabase
      .from("notifications")
      .delete()
      .eq("link", notificationLink)
      .eq("type", "announcement");

    if (notificationError) {
      toast.error(`Notification delete failed: ${notificationError.message}`);
      return;
    }

    const { error: announcementError } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);

    if (announcementError) {
      toast.error(`Announcement delete failed: ${announcementError.message}`);
      return;
    }

    toast.success("Announcement and its notifications deleted.");
    await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <AdminShell
      title="Announcements"
      subtitle="Sent to every student's notifications"
    >
      <div className="surface-card mb-6 space-y-3 p-4">
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
          />
        </Field>

        <Field label="Message">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your announcement..."
          />
        </Field>

        <Button
          onClick={post}
          disabled={!title.trim() || !body.trim() || saving}
        >
          {saving ? "Posting..." : "Post announcement"}
        </Button>
      </div>

      {list.isLoading ? (
        <LoadingState />
      ) : list.error ? (
        <div className="surface-card p-4 text-sm text-destructive">
          Failed to load announcements.
          <Button variant="outline" size="sm" onClick={() => list.refetch()}>
            Retry
          </Button>
        </div>
      ) : !list.data?.length ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <div className="grid gap-2">
          {list.data.map((a) => (
            <div
              key={a.id}
              className="surface-card flex items-start gap-2 p-3 text-sm"
            >
              <div className="flex-1">
                <p className="font-medium">{a.title}</p>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {a.body}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(a.created_at)}
                </p>
              </div>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => del(a.id)}
                aria-label="Delete announcement"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
