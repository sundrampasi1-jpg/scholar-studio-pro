import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { LoadingState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NativeSelect, run, confirmDelete, notifyAll } from "@/lib/admin-ui";

export const Route = createFileRoute("/_authenticated/admin/tests")({
  head: () => ({ meta: [{ title: "Tests & questions — JK Academy Admin" }, { name: "description", content: "Create MCQ tests and questions." }] }),
  component: AdminTests,
});

type Test = { id?: string; title: string; description: string | null; course_id: string | null; duration_minutes: number; total_marks: number; is_published: boolean };
type Q = { id?: string; test_id: string; question_text: string; option_a: string; option_b: string; option_c: string | null; option_d: string | null; correct_option: string; marks: number; solution: string | null; position: number };

function AdminTests() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Test | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const courses = useQuery({
    queryKey: ["admin-course-options"],
    queryFn: async () => (await supabase.from("courses").select("id, title").order("title")).data ?? [],
  });
  const tests = useQuery({
    queryKey: ["admin-tests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tests").select("*, courses(title), questions(count)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function save() {
    if (!edit?.title.trim()) return;
    const row = {
      title: edit.title.trim(),
      description: edit.description || null,
      course_id: edit.course_id || null,
      duration_minutes: Number(edit.duration_minutes) || 30,
      total_marks: Number(edit.total_marks) || 0,
      is_published: edit.is_published,
    };
    const ok = edit.id ? await run(supabase.from("tests").update(row).eq("id", edit.id)) : await run(supabase.from("tests").insert(row));
    if (ok) {
      if (!edit.id && row.is_published) await notifyAll(supabase, `New test: ${row.title}`, "test", "/tests");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["admin-tests"] });
    }
  }
  async function del(id: string, t: string) {
    if (confirmDelete(`test "${t}"`) && (await run(supabase.from("tests").delete().eq("id", id), "Deleted"))) {
      if (sel === id) setSel(null);
      qc.invalidateQueries({ queryKey: ["admin-tests"] });
    }
  }

  const current = tests.data?.find((t) => t.id === sel);

  return (
    <AdminShell
      title="Tests & questions"
      subtitle="Published tests appear on the students' Tests page"
      actions={<Button onClick={() => setEdit({ title: "", description: "", course_id: "", duration_minutes: 30, total_marks: 0, is_published: false })}><Plus className="mr-1.5 h-4 w-4" /> New test</Button>}
    >
      {tests.isLoading ? <LoadingState /> : !tests.data?.length ? <EmptyState title="No tests yet" /> : (
        <div className="grid gap-2">
          {tests.data.map((t) => (
            <div key={t.id} className={`surface-card flex flex-wrap items-center gap-2 p-3 text-sm ${sel === t.id ? "ring-2 ring-primary" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.questions?.[0]?.count ?? 0} questions · {t.duration_minutes} min · {t.courses?.title ?? "All students"}</p>
              </div>
              <Badge variant={t.is_published ? "default" : "secondary"}>{t.is_published ? "Published" : "Draft"}</Badge>
              <Button size="sm" variant="outline" onClick={() => setSel(t.id)}>Questions</Button>
              <Button size="icon" variant="ghost" onClick={() => setEdit(t)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => del(t.id, t.title)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      {current && <Questions testId={current.id} title={current.title} />}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit test" : "New test"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <Field label="Title"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="Description"><Textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              <Field label="Course">
                <NativeSelect value={edit.course_id ?? ""} onChange={(e) => setEdit({ ...edit, course_id: e.target.value })}>
                  <option value="">All students</option>
                  {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Duration (min)"><Input type="number" min={1} value={edit.duration_minutes} onChange={(e) => setEdit({ ...edit, duration_minutes: Number(e.target.value) })} /></Field>
                <Field label="Total marks"><Input type="number" min={0} value={edit.total_marks} onChange={(e) => setEdit({ ...edit, total_marks: Number(e.target.value) })} /></Field>
              </div>
              <div className="flex items-center gap-2 text-sm"><Switch checked={edit.is_published} onCheckedChange={(v) => setEdit({ ...edit, is_published: v })} /> Published</div>
              <Button className="w-full" onClick={save} disabled={!edit.title.trim()}>Save test</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function Questions({ testId, title }: { testId: string; title: string }) {
  const qc = useQueryClient();
  const key = ["admin-questions", testId];
  const [edit, setEdit] = useState<Q | null>(null);
  const qs = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("questions").select("*").eq("test_id", testId).order("position");
      if (error) throw error;
      return data as Q[];
    },
  });

  async function syncTotal() {
    const { data } = await supabase.from("questions").select("marks").eq("test_id", testId);
    const total = (data ?? []).reduce((s, q) => s + q.marks, 0);
    await supabase.from("tests").update({ total_marks: total }).eq("id", testId);
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["admin-tests"] });
  }
  async function save() {
    if (!edit || !edit.question_text.trim() || !edit.option_a.trim() || !edit.option_b.trim()) return;
    const { id, ...rest } = edit;
    const row = { ...rest, option_c: edit.option_c || null, option_d: edit.option_d || null, solution: edit.solution || null, marks: Number(edit.marks) || 1 };
    const ok = id ? await run(supabase.from("questions").update(row).eq("id", id)) : await run(supabase.from("questions").insert(row));
    if (ok) {
      setEdit(null);
      await syncTotal();
    }
  }
  async function del(id: string) {
    if (confirmDelete("this question") && (await run(supabase.from("questions").delete().eq("id", id), "Deleted"))) await syncTotal();
  }

  const blank = (): Q => ({ test_id: testId, question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "a", marks: 1, solution: "", position: qs.data?.length ?? 0 });

  return (
    <div className="surface-card mt-6 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Questions of “{title}”</h2>
        <Button size="sm" onClick={() => setEdit(blank())}><Plus className="mr-1 h-4 w-4" /> Question</Button>
      </div>
      {qs.isLoading ? <LoadingState /> : !qs.data?.length ? <p className="text-sm text-muted-foreground">No questions yet.</p> : (
        <ol className="space-y-2">
          {qs.data.map((q, i) => (
            <li key={q.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
              <span className="font-medium">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <p>{q.question_text}</p>
                <p className="text-xs text-muted-foreground">Answer: {q.correct_option.toUpperCase()} · {q.marks} mark(s)</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEdit(q)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => del(q.id!)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit question" : "New question"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <Field label="Question"><Textarea value={edit.question_text} onChange={(e) => setEdit({ ...edit, question_text: e.target.value })} /></Field>
              {(["a", "b", "c", "d"] as const).map((o) => (
                <Field key={o} label={`Option ${o.toUpperCase()}${o > "b" ? " (optional)" : ""}`}>
                  <Input value={edit[`option_${o}`] ?? ""} onChange={(e) => setEdit({ ...edit, [`option_${o}`]: e.target.value })} />
                </Field>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Correct option">
                  <NativeSelect value={edit.correct_option} onChange={(e) => setEdit({ ...edit, correct_option: e.target.value })}>
                    {["a", "b", "c", "d"].map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Marks"><Input type="number" min={1} value={edit.marks} onChange={(e) => setEdit({ ...edit, marks: Number(e.target.value) })} /></Field>
              </div>
              <Field label="Solution (optional)"><Textarea value={edit.solution ?? ""} onChange={(e) => setEdit({ ...edit, solution: e.target.value })} /></Field>
              <Button className="w-full" onClick={save}>Save question</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
