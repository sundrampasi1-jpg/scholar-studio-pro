import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { replyLessonReportAi } from "@/lib/ai-chat.functions";
import { AdminShell } from "@/components/AdminShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileText, Pencil, Trash2, Save, X, Clock, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reports")({ component: AdminReportsPage });

function AdminReportsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const askReportAi = useServerFn(replyLessonReportAi);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [teacherDrafts, setTeacherDrafts] = useState<Record<string, string>>({});
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentDraft, setEditCommentDraft] = useState("");

  async function refreshReports() {
    await queryClient.invalidateQueries({ queryKey: ["admin-lesson-reports"] });
  }
  async function refreshComments() {
    await queryClient.invalidateQueries({ queryKey: ["admin-lesson-comments"] });
  }
  async function generateReportReply(reportId: string) {
    if (generatingId) return;
    setGeneratingId(reportId);
    try {
      const result = await askReportAi({ data: { reportId } });
      if (!result.ok && "error" in result && result.error) toast.error(result.error);
      else toast.success("AI response generated");
      await refreshReports();
    } catch (error) { toast.error(error instanceof Error ? error.message : "AI reply could not be generated."); }
    finally { setGeneratingId(null); }
  }

  const reports = useQuery({
    queryKey: ["admin-lesson-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lesson_reports")
        .select("id, user_id, lesson_id, reason, details, status, created_at, ai_reply, ai_replied_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const lessonIds = [...new Set(rows.map((row) => row.lesson_id).filter(Boolean))];
      const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
      const { data: lessons } = lessonIds.length
        ? await supabase.from("lessons").select("id, title").in("id", lessonIds)
        : { data: [] };
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
        : { data: [] };
      const titles = new Map((lessons ?? []).map((lesson) => [lesson.id, lesson.title]));
      const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
      return rows.map((row) => ({ ...row, lesson_title: titles.get(row.lesson_id) ?? null, student_name: names.get(row.user_id) ?? "Student" }));
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
    await refreshComments();
    toast.success("Teacher reply sent");
  }
  async function updateComment(id: string) {
    const body = editCommentDraft.trim();
    if (!body) return;
    const { error } = await supabase.from("lesson_comments").update({ body }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditCommentId(null); setEditCommentDraft("");
    await refreshComments();
    toast.success("Comment updated");
  }
  async function removeComment(id: string, isParent: boolean) {
    if (!window.confirm(isParent ? "Delete this student comment and its replies?" : "Delete this reply?")) return;
    if (isParent) {
      const { error: childError } = await supabase.from("lesson_comments").delete().eq("parent_id", id);
      if (childError) { toast.error(childError.message); return; }
    }
    const { error } = await supabase.from("lesson_comments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refreshComments();
    toast.success("Comment deleted");
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
      await refreshReports();
    },
    onError: (error) => toast.error(error.message || "Could not update response"),
  });
  const clearReply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lesson_reports").update({ ai_reply: null, ai_replied_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("AI response deleted"); await refreshReports(); },
    onError: (error) => toast.error(error.message || "Could not delete response"),
  });
  async function saveReport(id: string) {
    if (!reportReason.trim()) return;
    const { error } = await supabase.from("lesson_reports").update({ reason: reportReason.trim(), details: reportDetails.trim() || null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditingReportId(null);
    await refreshReports();
    toast.success("Student report updated");
  }
  async function deleteReport(id: string) {
    if (!window.confirm("Delete this student report and its AI response?")) return;
    const { error } = await supabase.from("lesson_reports").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refreshReports();
    toast.success("Report deleted");
  }
  const dateText = (value: string) => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  return (
    <AdminShell title="Lesson Reports" subtitle="Student reports, comments and teacher/AI replies">
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4" /> Lesson Comments & Teacher Replies</h2>
          {comments.isLoading && <LoadingState />}
          {comments.error && <ErrorState error={comments.error} onRetry={() => void comments.refetch()} />}
          {!comments.isLoading && !comments.error && comments.data?.length === 0 && <EmptyState title="No lesson comments yet" />}
          <div className="space-y-3">
            {(comments.data ?? []).filter((item) => !item.parent_id).map((item) => <article key={item.id} className="rounded-xl border border-sky-200 bg-sky-50 p-3 dark:bg-sky-950/20">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">{item.lesson_title} · {item.author_name} · {dateText(item.created_at)}</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setEditCommentId(item.id); setEditCommentDraft(item.body); }}><Pencil className="mr-1 h-3 w-3" /> Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => void removeComment(item.id, true)}><Trash2 className="mr-1 h-3 w-3" /> Delete</Button>
                </div>
              </div>
              {editCommentId === item.id ? <div className="mt-2 space-y-2"><Textarea value={editCommentDraft} onChange={(e) => setEditCommentDraft(e.target.value)} /><div className="flex gap-2"><Button size="sm" onClick={() => void updateComment(item.id)}>Save</Button><Button size="sm" variant="outline" onClick={() => setEditCommentId(null)}>Cancel</Button></div></div> : <p className="mt-2 whitespace-pre-wrap text-sm font-medium">{item.body}</p>}
              {(comments.data ?? []).filter((reply) => reply.parent_id === item.id).map((reply) => <div key={reply.id} className={`mt-3 rounded-xl border p-3 ${reply.is_ai ? "border-violet-200 bg-violet-50 dark:bg-violet-950/20" : "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">{reply.is_ai ? "AI Teacher reply" : "Teacher reply"}</p><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => { setEditCommentId(reply.id); setEditCommentDraft(reply.body); }}><Pencil className="mr-1 h-3 w-3" /> Edit</Button><Button size="sm" variant="destructive" onClick={() => void removeComment(reply.id, false)}><Trash2 className="mr-1 h-3 w-3" /> Delete</Button></div></div>
                {editCommentId === reply.id ? <div className="mt-2 space-y-2"><Textarea value={editCommentDraft} onChange={(e) => setEditCommentDraft(e.target.value)} /><div className="flex gap-2"><Button size="sm" onClick={() => void updateComment(reply.id)}>Save</Button><Button size="sm" variant="outline" onClick={() => setEditCommentId(null)}>Cancel</Button></div></div> : <p className="mt-2 whitespace-pre-wrap text-sm">{reply.body}</p>}
              </div>)}
              <Textarea className="mt-3 bg-white" rows={2} placeholder="Reply as Teacher…" value={teacherDrafts[item.id] ?? ""} onChange={(e) => setTeacherDrafts((old) => ({ ...old, [item.id]: e.target.value }))} />
              <Button className="mt-2" size="sm" disabled={!teacherDrafts[item.id]?.trim()} onClick={() => void teacherReply(item)}>Send Teacher reply</Button>
            </article>)}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-semibold">My Reports / Student Reports</h2><span className="rounded-full bg-muted px-3 py-1 text-xs">{reports.data?.length ?? 0} reports</span></div>
          {reports.isLoading && <LoadingState />}
          {reports.error && <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />}
          {!reports.isLoading && !reports.error && reports.data?.length === 0 && <EmptyState title="No lesson reports" description="Student lesson reports will appear here." />}
          {reports.data?.map((report) => <article key={report.id} className="min-w-0 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reported lesson</p><h3 className="break-words font-bold">{report.lesson_title || "Lesson"}</h3><p className="mt-1 text-xs text-muted-foreground">{report.student_name} · {dateText(report.created_at)}</p></div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{report.status || "open"}</span>
            </div>
            {editingReportId === report.id ? <div className="mt-3 space-y-2 rounded-xl border bg-muted/30 p-3"><Input value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="Problem category" /><Textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Student details" /><div className="flex gap-2"><Button size="sm" onClick={() => void saveReport(report.id)}>Save report</Button><Button size="sm" variant="outline" onClick={() => setEditingReportId(null)}>Cancel</Button></div></div> : <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:bg-rose-950/20"><p className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">Student's original problem</p><p className="mt-1 break-words text-sm font-semibold">{report.reason}</p>{report.details && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{report.details}</p>}</div>}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {dateText(report.created_at)}</p>
            <section className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:bg-emerald-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-200"><MessageCircle className="h-4 w-4" /> JK Academy AI / Teacher Solution</h4><div className="flex flex-wrap gap-1">{!report.ai_reply && <Button size="sm" variant="outline" disabled={!!generatingId} onClick={() => void generateReportReply(report.id)}>{generatingId === report.id ? "Generating…" : "Generate AI reply"}</Button>}<Button size="sm" variant="outline" onClick={() => { setEditingId(report.id); setDraft(report.ai_reply || ""); }}><Pencil className="mr-1 h-3 w-3" /> Edit</Button>{report.ai_reply && <Button size="sm" variant="destructive" disabled={clearReply.isPending} onClick={() => clearReply.mutate(report.id)}><Trash2 className="mr-1 h-3 w-3" /> Delete reply</Button>}</div></div>
              {editingId === report.id ? <div className="mt-3 space-y-2"><Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} placeholder="Write practical solution for the student…" /><div className="flex gap-2"><Button size="sm" disabled={saveReply.isPending} onClick={() => saveReply.mutate({ id: report.id, reply: draft })}><Save className="mr-1 h-4 w-4" /> Save reply</Button><Button size="sm" variant="outline" onClick={() => { setEditingId(null); setDraft(""); }}><X className="mr-1 h-4 w-4" /> Cancel</Button></div></div> : <p className="mt-2 whitespace-pre-wrap break-words text-sm">{report.ai_reply || "No solution has been sent yet. Generate an AI reply or write a teacher response."}</p>}
              {report.ai_replied_at && editingId !== report.id && <p className="mt-2 text-[11px] text-muted-foreground">Replied: {dateText(report.ai_replied_at)}</p>}
            </section>
            <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setEditingReportId(report.id); setReportReason(report.reason); setReportDetails(report.details ?? ""); }}><Pencil className="mr-1 h-3 w-3" /> Edit student report</Button><Button size="sm" variant="destructive" onClick={() => void deleteReport(report.id)}><Trash2 className="mr-1 h-3 w-3" /> Delete report</Button></div>
          </article>)}
        </section>
      </div>
    </AdminShell>
  );
}
