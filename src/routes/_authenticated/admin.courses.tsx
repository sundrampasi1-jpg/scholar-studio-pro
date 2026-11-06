import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { MediaInput } from "@/components/MediaInput";
import { LoadingState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, run, confirmDelete, notifyAll } from "@/lib/admin-ui";

export const Route = createFileRoute("/_authenticated/admin/courses")({
  head: () => ({
    meta: [
      { title: "Manage courses & lessons — JK Academy Admin" },
      { name: "description", content: "Create courses, subjects, chapters and video lessons." },
    ],
  }),
  component: AdminCourses,
});

type Course = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  is_free: boolean;
  is_published: boolean;
};
type Lesson = {
  id: string;
  chapter_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  pdf_url: string | null;
  duration_minutes: number | null;
  position: number;
  is_published: boolean;
};

function AdminCourses() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Course> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const courses = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Course[];
    },
  });

  async function saveCourse() {
    if (!editing?.title?.trim()) return;
    const row = {
      title: editing.title.trim(),
      description: editing.description ?? null,
      thumbnail_url: editing.thumbnail_url || null,
      price: editing.is_free ? 0 : Number(editing.price ?? 0),
      is_free: !!editing.is_free,
      is_published: editing.is_published ?? true,
    };
    const ok = editing.id
      ? await run(supabase.from("courses").update(row).eq("id", editing.id))
      : await run(supabase.from("courses").insert(row));
    if (ok) {
      if (!editing.id && row.is_published) await notifyAll(supabase, `New course: ${row.title}`, "course", "/courses");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
    }
  }

  async function deleteCourse(c: Course) {
    if (!confirmDelete(`course "${c.title}"`)) return;
    if (await run(supabase.from("courses").delete().eq("id", c.id), "Deleted")) {
      if (selected === c.id) setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
    }
  }

  const list = (courses.data ?? []).filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
  const current = courses.data?.find((c) => c.id === selected);

  return (
    <AdminShell
      title="Courses, lessons & videos"
      subtitle="Course → Subject → Chapter → Lesson (video + PDF)"
      actions={
        <Button onClick={() => setEditing({ is_published: true, is_free: false, price: 0 })}>
          <Plus className="mr-1.5 h-4 w-4" /> New course
        </Button>
      }
    >
      <Input placeholder="Search courses…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 max-w-sm" />
      {courses.isLoading ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <EmptyState title="No courses yet" description="Create your first course to start adding lessons." />
      ) : (
        <div className="grid gap-2">
          {list.map((c) => (
            <div key={c.id} className={`surface-card flex flex-wrap items-center gap-2 p-3 ${selected === c.id ? "ring-2 ring-primary" : ""}`}>
              <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(selected === c.id ? null : c.id)}>
                <p className="truncate font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.is_free ? "Free" : `₹${c.price}`}</p>
              </button>
              <Badge variant={c.is_published ? "default" : "secondary"}>{c.is_published ? "Published" : "Draft"}</Badge>
              <Button size="sm" variant="outline" onClick={() => setSelected(c.id)}>Manage content</Button>
              <Button size="icon" variant="ghost" onClick={() => setEditing(c)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => deleteCourse(c)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      {current && <CourseContent course={current} />}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit course" : "New course"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Title"><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="Description"><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
              <Field label="Thumbnail image">
                <MediaInput kind="image" folder="thumbnails" value={editing.thumbnail_url ?? ""} onChange={(v) => setEditing({ ...editing, thumbnail_url: v })} />
              </Field>
              <div className="flex items-center gap-2"><Switch checked={!!editing.is_free} onCheckedChange={(v) => setEditing({ ...editing, is_free: v })} /> Free course</div>
              {!editing.is_free && (
                <Field label="Price (₹)"><Input type="number" min={0} value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></Field>
              )}
              <div className="flex items-center gap-2"><Switch checked={editing.is_published ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_published: v })} /> Published (visible to students)</div>
              <Button className="w-full" onClick={saveCourse} disabled={!editing.title?.trim()}>Save course</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function CourseContent({ course }: { course: Course }) {
  const qc = useQueryClient();
  const key = ["admin-course-tree", course.id];
  const [lesson, setLesson] = useState<Partial<Lesson> | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [batchName, setBatchName] = useState("");
  const [validityDrafts, setValidityDrafts] = useState<Record<string, string>>({});
  const batches = useQuery({
    queryKey: ["admin-course-batches", course.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("batches")
        .select("id, name, validity_days, is_active, start_date, end_date")
        .eq("course_id", course.id).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  async function addBatch() {
    const name = batchName.trim();
    if (!name) return;
    if (await run(supabase.from("batches").insert({ course_id: course.id, name, validity_days: 365, is_active: true }))) {
      setBatchName("");
      qc.invalidateQueries({ queryKey: ["admin-course-batches", course.id] });
    }
  }
  async function saveBatchValidity(id: string, currentDays: number) {
    const parsed = Number(validityDrafts[id] ?? currentDays);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
      window.alert("Validity must be between 1 and 3650 days.");
      return;
    }
    if (await run(supabase.from("batches").update({ validity_days: parsed }).eq("id", id), "Validity saved")) {
      setValidityDrafts((old) => { const next = { ...old }; delete next[id]; return next; });
      qc.invalidateQueries({ queryKey: ["admin-course-batches", course.id] });
    }
  }

  const tree = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, position, chapters(id, name, position, lessons(*))")
        .eq("course_id", course.id)
        .order("position");
      if (error) throw error;
      return (data ?? []).map((s) => ({
        ...s,
        chapters: [...(s.chapters ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((c) => ({ ...c, lessons: [...((c.lessons ?? []) as Lesson[])].sort((a, b) => a.position - b.position) })),
      }));
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function addSubject() {
    const name = window.prompt("Subject name");
    if (name?.trim() && (await run(supabase.from("subjects").insert({ course_id: course.id, name: name.trim(), position: tree.data?.length ?? 0 })))) refresh();
  }
  async function renameRow(table: "subjects" | "chapters", id: string, cur: string) {
    const name = window.prompt("New name", cur);
    if (name?.trim() && (await run(supabase.from(table).update({ name: name.trim() }).eq("id", id)))) refresh();
  }
  async function delRow(table: "subjects" | "chapters" | "lessons", id: string, label: string) {
    if (confirmDelete(label) && (await run(supabase.from(table).delete().eq("id", id), "Deleted"))) refresh();
  }
  async function addChapter(subjectId: string, count: number) {
    const name = window.prompt("Chapter name");
    if (name?.trim() && (await run(supabase.from("chapters").insert({ subject_id: subjectId, name: name.trim(), position: count })))) {
      setOpen((o) => ({ ...o, [subjectId]: true }));
      refresh();
    }
  }
  async function saveLesson() {
    if (!lesson?.title?.trim() || !lesson.chapter_id) return;
    const row = {
      chapter_id: lesson.chapter_id,
      title: lesson.title.trim(),
      description: lesson.description || null,
      video_url: lesson.video_url || null,
      pdf_url: lesson.pdf_url || null,
      duration_minutes: lesson.duration_minutes ? Number(lesson.duration_minutes) : null,
      position: lesson.position ?? 0,
      is_published: lesson.is_published ?? true,
    };
    const ok = lesson.id
      ? await run(supabase.from("lessons").update(row).eq("id", lesson.id))
      : await run(supabase.from("lessons").insert(row));
    if (ok) {
      if (!lesson.id && row.is_published) await notifyAll(supabase, `New lesson in ${course.title}: ${row.title}`, "lesson", `/courses/${course.id}`);
      setLesson(null);
      refresh();
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <section className="surface-card p-4">
        <h2 className="font-semibold">Batch validity & access period</h2>
        <p className="mt-1 text-xs text-muted-foreground">New verified purchases and renewals use the batch validity. Default is 365 days.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="New batch name" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
          <Button size="sm" onClick={() => void addBatch()} disabled={!batchName.trim()}><Plus className="mr-1 h-4 w-4" /> Add batch</Button>
        </div>
        {batches.isLoading ? <LoadingState /> : batches.data?.length ? (
          <div className="mt-3 space-y-2">
            {batches.data.map((batch) => <div key={batch.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
              <span className="min-w-0 flex-1 text-sm font-medium">{batch.name} {batch.is_active ? "" : "(inactive)"}</span>
              <Input className="w-24" type="number" min={1} max={3650} value={validityDrafts[batch.id] ?? String(batch.validity_days)} onChange={(e) => setValidityDrafts((old) => ({ ...old, [batch.id]: e.target.value }))} />
              <span className="text-xs text-muted-foreground">days</span>
              <Button size="sm" variant="outline" onClick={() => void saveBatchValidity(batch.id, batch.validity_days)}>Save</Button>
            </div>)}
          </div>
        ) : <p className="mt-3 text-xs text-muted-foreground">No batches created for this course yet.</p>}
      </section>
      <div className="surface-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Content of “{course.title}”</h2>
        <Button size="sm" onClick={addSubject}><Plus className="mr-1 h-4 w-4" /> Subject</Button>
      </div>
      {tree.isLoading ? (
        <LoadingState />
      ) : !tree.data?.length ? (
        <p className="text-sm text-muted-foreground">Add a subject, then chapters and lessons inside it.</p>
      ) : (
        <div className="space-y-2">
          {tree.data.map((s) => (
            <div key={s.id} className="rounded-md border">
              <div className="flex items-center gap-1 bg-muted/50 p-2">
                <button className="flex flex-1 items-center gap-1 text-left text-sm font-medium" onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}>
                  {open[s.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} {s.name}
                </button>
                <Button size="sm" variant="ghost" onClick={() => addChapter(s.id, s.chapters.length)}><Plus className="mr-1 h-3 w-3" />Chapter</Button>
                <Button size="icon" variant="ghost" onClick={() => renameRow("subjects", s.id, s.name)} aria-label="Rename"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => delRow("subjects", s.id, `subject "${s.name}"`)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
              </div>
              {open[s.id] && (
                <div className="space-y-2 p-2">
                  {s.chapters.length === 0 && <p className="px-2 text-xs text-muted-foreground">No chapters yet.</p>}
                  {s.chapters.map((ch) => (
                    <div key={ch.id} className="rounded-md border p-2">
                      <div className="flex items-center gap-1">
                        <p className="flex-1 text-sm font-medium">{ch.name}</p>
                        <Button size="sm" variant="outline" onClick={() => setLesson({ chapter_id: ch.id, position: ch.lessons.length, is_published: true })}>
                          <Plus className="mr-1 h-3 w-3" />Lesson
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => renameRow("chapters", ch.id, ch.name)} aria-label="Rename"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => delRow("chapters", ch.id, `chapter "${ch.name}"`)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <ul className="mt-1 divide-y">
                        {ch.lessons.map((l) => (
                          <li key={l.id} className="flex items-center gap-2 py-1.5 text-sm">
                            <span className="min-w-0 flex-1 truncate">{l.title}</span>
                            {l.video_url && <Badge variant="secondary">Video</Badge>}
                            {l.pdf_url && <Badge variant="secondary">PDF</Badge>}
                            {!l.is_published && <Badge variant="outline">Draft</Badge>}
                            <Button size="icon" variant="ghost" onClick={() => setLesson(l)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => delRow("lessons", l.id, `lesson "${l.title}"`)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!lesson} onOpenChange={(o) => !o && setLesson(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lesson?.id ? "Edit lesson" : "New lesson"}</DialogTitle></DialogHeader>
          {lesson && (
            <div className="space-y-3">
              <Field label="Title"><Input value={lesson.title ?? ""} onChange={(e) => setLesson({ ...lesson, title: e.target.value })} /></Field>
              <Field label="Description"><Textarea value={lesson.description ?? ""} onChange={(e) => setLesson({ ...lesson, description: e.target.value })} /></Field>
              <Field label="Video (upload, record or paste link)">
                <MediaInput kind="video" folder="videos" value={lesson.video_url ?? ""} onChange={(v) => setLesson((l) => ({ ...l, video_url: v }))} />
              </Field>
              <Field label="PDF / notes">
                <MediaInput kind="pdf" folder="lesson-pdfs" value={lesson.pdf_url ?? ""} onChange={(v) => setLesson((l) => ({ ...l, pdf_url: v }))} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Duration (min)"><Input type="number" min={0} value={lesson.duration_minutes ?? ""} onChange={(e) => setLesson({ ...lesson, duration_minutes: Number(e.target.value) || null })} /></Field>
                <Field label="Order"><Input type="number" min={0} value={lesson.position ?? 0} onChange={(e) => setLesson({ ...lesson, position: Number(e.target.value) })} /></Field>
              </div>
              <div className="flex items-center gap-2"><Switch checked={lesson.is_published ?? true} onCheckedChange={(v) => setLesson({ ...lesson, is_published: v })} /> Published</div>
              <Button className="w-full" onClick={saveLesson} disabled={!lesson.title?.trim()}>Save lesson</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
