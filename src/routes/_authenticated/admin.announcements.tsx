import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { LoadingState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, run, confirmDelete, notifyAll } from "@/lib/admin-ui";
import { formatDateTime } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  head: () => ({ meta: [{ title: "Announcements — JK Academy Admin" }, { name: "description", content: "Send announcements to students." }] }),
  component: AdminAnnouncements,
});

function AdminAnnouncements() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const list = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function post() {
    if (!title.trim() || !body.trim()) return;
    if (await run(supabase.from("announcements").insert({ title: title.trim(), body: body.trim() }), "Announcement posted")) {
      await notifyAll(supabase, title.trim(), "announcement", "/notifications");
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    }
  }
  async function del(id: string) {
    if (confirmDelete("this announcement") && (await run(supabase.from("announcements").delete().eq("id", id), "Deleted")))
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  return (
    <AdminShell title="Announcements" subtitle="Sent to every student's notifications">
      <div className="surface-card mb-6 space-y-3 p-4">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Message"><Textarea value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <Button onClick={post} disabled={!title.trim() || !body.trim()}>Post announcement</Button>
      </div>
      {list.isLoading ? <LoadingState /> : !list.data?.length ? <EmptyState title="No announcements yet" /> : (
        <div className="grid gap-2">
          {list.data.map((a) => (
            <div key={a.id} className="surface-card flex items-start gap-2 p-3 text-sm">
              <div className="flex-1">
                <p className="font-medium">{a.title}</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{a.body}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del(a.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
