import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { LoadingState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { run } from "@/lib/admin-ui";
import { formatDateTime } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/doubts")({
  head: () => ({ meta: [{ title: "Student doubts — JK Academy Admin" }, { name: "description", content: "Reply to student doubts." }] }),
  component: AdminDoubts,
});

function AdminDoubts() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("pending");
  const [reply, setReply] = useState<Record<string, string>>({});
  const doubts = useQuery({
    queryKey: ["admin-doubts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("doubts").select("*, doubt_replies(id, body, created_at)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-doubts"] });

  async function send(d: { id: string; user_id: string; title: string }) {
    const body = reply[d.id]?.trim();
    if (!body || !user) return;
    if (await run(supabase.from("doubt_replies").insert({ doubt_id: d.id, user_id: user.id, body }), "Reply sent")) {
      await supabase.from("doubts").update({ status: "resolved" }).eq("id", d.id);
      await supabase.from("notifications").insert({ user_id: d.user_id, title: `Your doubt was answered: ${d.title}`, type: "doubt", link: "/doubts" });
      setReply((r) => ({ ...r, [d.id]: "" }));
      refresh();
    }
  }
  async function setStatus(id: string, status: string) {
    if (await run(supabase.from("doubts").update({ status }).eq("id", id))) refresh();
  }

  const list = (doubts.data ?? []).filter((d) => filter === "all" || d.status === filter);

  return (
    <AdminShell title="Doubts" subtitle="Answer student questions">
      <div className="mb-3 flex gap-2">
        {(["pending", "resolved", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
      </div>
      {doubts.isLoading ? <LoadingState /> : list.length === 0 ? <EmptyState title="No doubts here" /> : (
        <div className="grid gap-3">
          {list.map((d) => (
            <div key={d.id} className="surface-card space-y-2 p-4 text-sm">
              <div className="flex items-center gap-2">
                <p className="flex-1 font-medium">{d.title}</p>
                <Badge variant={d.status === "resolved" ? "default" : "secondary"}>{d.status}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground">{d.body}</p>
              {d.image_url && <img src={d.image_url} alt="Doubt attachment" className="max-h-60 rounded-md border" />}
              <p className="text-xs text-muted-foreground">{formatDateTime(d.created_at)}</p>
              {d.doubt_replies?.map((r) => (
                <div key={r.id} className="rounded-md bg-muted p-2">{r.body}</div>
              ))}
              <Textarea placeholder="Write a reply…" value={reply[d.id] ?? ""} onChange={(e) => setReply({ ...reply, [d.id]: e.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => send(d)} disabled={!reply[d.id]?.trim()}>Send reply</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(d.id, d.status === "resolved" ? "pending" : "resolved")}>
                  Mark {d.status === "resolved" ? "pending" : "resolved"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
