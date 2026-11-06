import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Pencil, Trash2, Save, X, Clock, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reports")({ component: AdminReportsPage });

function AdminReportsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [teacherDrafts, setTeacherDrafts] = useState<Record<string, string>>({});
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentDraft, setEditCommentDraft] = useState("");
  const reports = useQuery({
    queryKey: ["admin-lesson-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lesson_reports")
        .select("id, user_id, lesson_id, reason, details, status, created_at, ai_reply, ai_replied_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const lessonIds = [...new Set(rows.map((row) => row.lesson_id).filter(Boolean))];
      if (!lessonIds.length) return rows.map((row) => ({ ...row, lesson_title: null }));
      const { data: lessons, error: lessonError } = await supabase
        .from("lessons")
        .select("id, title")
        .in("id", lessonIds);
      // Lesson titles are supplementary: a title lookup/RLS hiccup must not hide reports.
      if (lessonError) console.error("Admin reports: lesson title lookup failed", lessonError);
      const titles = new Map((lessons ?? []).map((lesson) => [lesson.id, lesson.title]));
      return rows.map((row) => ({ ...row, lesson_title: titles.get(row.lesson_id) ?? null }));
    },
  });

  const comments = useQuery({
    queryKey: ["admin-lesson-comments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lesson_comments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const ids = [...new Set(rows.map((row) => row.lesson_id))];
      const { data: lessons } = ids.length ? await supabase.from("lessons").select("id,title").in("id", ids) : { data: [] };
      const titles = new Map((lessons ?? []).map((lesson) => [lesson.id, lesson.title]));
      return rows.map((row) => ({ ...row, lesson_title: titles.get(row.lesson_id) ?? "Lesson" }));
    },
  });
  async function teacherReply(parent: { id: string; lesson_id: string }) {
    const body = teacherDrafts[parent.id]?.trim();
    const { data: auth } = await supabase.auth.getUser();
    if (!body || !auth.user) return;
    const { error } = await supabase.from("lesson_comments").insert({
      lesson_id: parent.lesson_id, user_id: auth.user.id, parent_id: parent.id,
      author_name: "Teacher", body, is_ai: false,
    });
    if (error) { toast.error(error.message); return; }
    setTeacherDrafts((old) => ({ ...old, [parent.id]: "" }));
    await queryClient.invalidateQueries({ queryKey: ["admin-lesson-comments"] });
    toast.success("Teacher reply sent");
  }
  async function updateTeacherReply(id: string) {
    const body = editCommentDraft.trim();
    if (!body) return;
    const { error } = await supabase.from("lesson_comments").update({ body }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditCommentId(null); setEditCommentDraft("");
    await queryClient.invalidateQueries({ queryKey: ["admin-lesson-comments"] });
  }
  async function removeTeacherReply(id: string) {
    if (!window.confirm("Delete this Teacher reply?")) return;
    const { error } = await supabase.from("lesson_comments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await queryClient.invalidateQueries({ queryKey: ["admin-lesson-comments"] });
  }

  const saveReply = useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      const value = reply.trim();
      const { error } = await supabase.from("lesson_reports").update({
        ai_reply: value || null, ai_replied_at: value ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("AI response updated");
      setEditingId(null); setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["admin-lesson-reports"] });
    },
    onError: (error) => toast.error(error.message || "Could not update response"),
  });
  const clearReply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lesson_reports").update({ ai_reply: null, ai_replied_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("AI response deleted");
      await queryClient.invalidateQueries({ queryKey: ["admin-lesson-reports"] });
    },
    onError: (error) => toast.error(error.message || "Could not delete response"),
  });
  const dateText = (value: string) => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  return (
    <AdminShell title="Lesson Reports" subtitle="Review student reports and manage AI responses">
      <div className="min-w-0 space-y-4">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4" />Lesson Comments & Teacher Replies</h2>
          {comments.isLoading && <LoadingState />}
          {comments.error && <ErrorState error={comments.error} onRetry={() => void comments.refetch()} />}
          {!comments.isLoading && !comments.error && comments.data?.length === 0 && <EmptyState title="No lesson comments yet" />}
          <div className="space-y-3">
            {(comments.data ?? []).filter((item) => !item.parent_id).map((item) => <article key={item.id} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{item.lesson_title} · {item.author_name} · {dateText(item.created_at)}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{item.body}</p>
              {(comments.data ?? []).filter((reply) => reply.parent_id === item.id).map((reply) => <div key={reply.id} className="mt-2 rounded-md bg-muted p-2">
                <p className="text-xs font-semibold">{reply.is_ai ? "AI Teacher" : "Teacher"}</p>
                {editCommentId === reply.id ? <div className="space-y-2"><Textarea value={editCommentDraft} onChange={(e) => setEditCommentDraft(e.target.value)} /><Button size="sm" onClick={() => void updateTeacherReply(reply.id)}>Save</Button></div> : <p className="whitespace-pre-wrap text-sm">{reply.body}</p>}
                {!reply.is_ai && <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => { setEditCommentId(reply.id); setEditCommentDraft(reply.body); }}>Edit</Button><Button size="sm" variant="destructive" onClick={() => void removeTeacherReply(reply.id)}>Delete</Button></div>}
              </div>)}
              <Textarea className="mt-3" rows={2} placeholder="Reply as Teacher…" value={teacherDrafts[item.id] ?? ""} onChange={(e) => setTeacherDrafts((old) => ({ ...old, [item.id]: e.target.value }))} />
              <Button className="mt-2" size="sm" disabled={!teacherDrafts[item.id]?.trim()} onClick={() => void teacherReply(item)}>Send Teacher reply</Button>
            </article>)}
          </div>
        </section>

        {reports.isLoading && <LoadingState />}
        {reports.error && <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />}
        {!reports.isLoading && !reports.error && reports.data?.length === 0 && <EmptyState title="No lesson reports" description="Student lesson reports will appear here." />}
        {reports.data?.map((report) => {
          return (
            <article key={report.id} className="min-w-0 overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lesson</p>
                  <h2 className="break-words font-semibold">{report.lesson_title || "Lesson"}</h2>
                  <p className="mt-1 break-all text-xs text-muted-foreground">Student ID: {report.user_id}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-semibold">{report.status || "open"}</span>
              </div>
              <div className="mt-3 rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-bold text-muted-foreground">REPORTED PROBLEM</p>
                <p className="mt-1 break-words text-sm font-semibold">{report.reason}</p>
                {report.details && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{report.details}</p>}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {dateText(report.created_at)}</p>
              <section className="mt-4 min-w-0 rounded-lg border border-primary/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4" /> JK Academy AI Response</h3>
                  {editingId !== report.id && <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(report.id); setDraft(report.ai_reply || ""); }}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                    {report.ai_reply && <Button size="sm" variant="destructive" disabled={clearReply.isPending} onClick={() => clearReply.mutate(report.id)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>}
                  </div>}
                </div>
                {editingId === report.id ? <div className="mt-3 space-y-2">
                  <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} placeholder="Write AI response..." className="w-full min-w-0 resize-y" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={saveReply.isPending} onClick={() => saveReply.mutate({ id: report.id, reply: draft })}><Save className="mr-1 h-4 w-4" /> Save response</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setDraft(""); }}><X className="mr-1 h-4 w-4" /> Cancel</Button>
                  </div>
                </div> : <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{report.ai_reply || "No AI response yet."}</p>}
                {report.ai_replied_at && editingId !== report.id && <p className="mt-2 text-[11px] text-muted-foreground">Updated: {dateText(report.ai_replied_at)}</p>}
              </section>
            </article>
          );
        })}
      </div>
    </AdminShell>
  );
}
