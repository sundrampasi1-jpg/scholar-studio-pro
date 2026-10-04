import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { MediaInput } from "@/components/MediaInput";
import { LoadingState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/reels")({
  head: () => ({ meta: [{ title: "Reels — JK Academy Admin" }, { name: "description", content: "Upload and manage short videos." }] }),
  component: AdminReels,
});

function AdminReels() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const reels = useQuery({
    queryKey: ["admin-reels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reels").select("*, reel_likes(count), reel_comments(count)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-reels"] });
    qc.invalidateQueries({ queryKey: ["reels"] });
  };

  async function add() {
    if (!url) { toast.error("Upload or record a video first"); return; }
    const { error } = await supabase.from("reels").insert({ title: title.trim(), video_url: url });
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({ user_id: null, title: "New reel", body: title.trim() || "A new short video is up", type: "reel", link: "/reels" });
    toast.success("Reel published");
    setTitle("");
    setUrl("");
    refresh();
  }

  async function update(id: string, patch: { is_published?: boolean }) {
    const { error } = await supabase.from("reels").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this reel?")) return;
    const { error } = await supabase.from("reels").delete().eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  }

  return (
    <AdminShell title="Reels" subtitle="Short vertical videos for students">
      <div className="surface-card mb-6 space-y-3 p-4">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Caption (optional)" maxLength={200} />
        <MediaInput value={url} onChange={setUrl} kind="video" folder="reels" />
        <Button onClick={add}>Publish reel</Button>
      </div>
      {reels.isLoading ? <LoadingState /> : !reels.data?.length ? <EmptyState title="No reels yet" /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {reels.data.map((r) => (
            <div key={r.id} className="surface-card overflow-hidden">
              <video src={r.video_url} className="aspect-[9/16] w-full bg-muted object-cover" muted playsInline preload="metadata" />
              <div className="space-y-2 p-2 text-xs">
                <p className="truncate font-medium">{r.title || "Untitled"}</p>
                <p className="text-muted-foreground">{r.reel_likes[0]?.count ?? 0} likes · {r.reel_comments[0]?.count ?? 0} comments</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => update(r.id, { is_published: !r.is_published })}>{r.is_published ? "Hide" : "Show"}</Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(r.id)}>Delete</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
