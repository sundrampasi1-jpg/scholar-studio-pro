import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type LiveComment = {
  id: string;
  live_class_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  is_teacher_reply: boolean;
  created_at: string;
  author_name: string;
};

export function LiveClassChat({ liveClassId, mode }: { liveClassId: string; mode: "admin" | "student" }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const comments = useQuery({
    queryKey: ["live-class-comments", liveClassId],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("live_class_comments")
        .select("id, live_class_id, user_id, parent_id, body, is_teacher_reply, created_at")
        .eq("live_class_id", liveClassId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((row) => row.user_id))];
      const { data: profiles, error: profileError } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
      return (data ?? []).map((row) => ({
        ...row,
        author_name: row.is_teacher_reply ? "JK Academy Teacher" : names.get(row.user_id) || "Student",
      })) as LiveComment[];
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`live-class-comments-${liveClassId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_class_comments", filter: `live_class_id=eq.${liveClassId}` }, () => {
        void qc.invalidateQueries({ queryKey: ["live-class-comments", liveClassId] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [liveClassId, qc]);

  async function send(body: string, parentId: string | null, teacherReply: boolean) {
    const value = body.trim();
    if (!value || !user?.id) return;
    const { error } = await supabase.from("live_class_comments").insert({
      live_class_id: liveClassId,
      user_id: user.id,
      parent_id: parentId,
      body: value,
      is_teacher_reply: teacherReply,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (teacherReply) {
      setReplyTo(null);
      setReplyDraft("");
    } else {
      setDraft("");
    }
    await qc.invalidateQueries({ queryKey: ["live-class-comments", liveClassId] });
  }

  const roots = (comments.data ?? []).filter((comment) => !comment.parent_id);
  const replies = (comments.data ?? []).filter((comment) => !!comment.parent_id);

  return (
    <section className="mt-4 rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h3 className="font-bold">Live class questions</h3>
        <span className="ml-auto text-xs text-muted-foreground">{comments.data?.length ?? 0}</span>
      </div>

      {comments.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading questions…</p>
      ) : roots.length === 0 ? (
        <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">No questions yet. Students can ask here during the live class.</p>
      ) : (
        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {roots.map((comment) => (
            <article key={comment.id} className={comment.is_teacher_reply ? "rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-black" : "rounded-xl border bg-background p-3"}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold">{comment.author_name}</p>
                <time className="text-[10px] text-muted-foreground">{new Date(comment.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
              {replies.filter((reply) => reply.parent_id === comment.id).map((reply) => (
                <div key={reply.id} className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-black">
                  <p className="text-xs font-bold">{reply.author_name}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{reply.body}</p>
                </div>
              ))}
              {mode === "admin" && (
                <div className="mt-2">
                  {replyTo === comment.id ? (
                    <div className="space-y-2">
                      <Textarea value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Reply to this question…" rows={2} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void send(replyDraft, comment.id, true)} disabled={!replyDraft.trim()}>Send reply</Button>
                        <Button size="sm" variant="outline" onClick={() => { setReplyTo(null); setReplyDraft(""); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setReplyTo(comment.id)}>Reply</Button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {mode === "student" && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask your question about this live class…" rows={2} maxLength={2000} />
          <Button className="w-full" onClick={() => void send(draft, null, false)} disabled={!draft.trim()}>
            <Send className="mr-2 h-4 w-4" /> Send question
          </Button>
        </div>
      )}
    </section>
  );
}
