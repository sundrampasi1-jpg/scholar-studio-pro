import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { MediaInput } from "@/components/MediaInput";
import { LoadingState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NativeSelect, run, confirmDelete, notifyAll } from "@/lib/admin-ui";
import { formatDateTime, liveStatus } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/live")({
  head: () => ({ meta: [{ title: "Live classes — JK Academy Admin" }, { name: "description", content: "Schedule live classes and add recordings." }] }),
  component: AdminLive,
});

type Live = {
  id?: string;
  title: string;
  description: string | null;
  course_id: string | null;
  teacher_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
  join_url: string | null;
  recording_url: string | null;
};

function toLocal(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function AdminLive() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Live | null>(null);
  const courses = useQuery({
    queryKey: ["admin-course-options"],
    queryFn: async () => (await supabase.from("courses").select("id, title").order("title")).data ?? [],
  });
  const lives = useQuery({
    queryKey: ["admin-live"],
    queryFn: async () => {
      const { data, error } = await supabase.from("live_classes").select("*, courses(title)").order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function save() {
    if (!edit?.title.trim() || !edit.scheduled_at) return;
    const row = {
      title: edit.title.trim(),
      description: edit.description || null,
      course_id: edit.course_id || null,
      teacher_name: edit.teacher_name || null,
      scheduled_at: new Date(edit.scheduled_at).toISOString(),
      duration_minutes: Number(edit.duration_minutes) || 60,
      join_url: edit.join_url || null,
      recording_url: edit.recording_url || null,
    };
    const ok = edit.id
      ? await run(supabase.from("live_classes").update(row).eq("id", edit.id))
      : await run(supabase.from("live_classes").insert(row));
    if (ok) {
      if (!edit.id) await notifyAll(supabase, `Live class scheduled: ${row.title} (${formatDateTime(row.scheduled_at)})`, "live", "/live");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["admin-live"] });
    }
  }
  async function del(id: string, t: string) {
    if (confirmDelete(`"${t}"`) && (await run(supabase.from("live_classes").delete().eq("id", id), "Deleted"))) qc.invalidateQueries({ queryKey: ["admin-live"] });
  }

  return (
    <AdminShell
      title="Live classes"
      subtitle="Scheduled classes appear on the students' Live page"
      actions={
        <Button onClick={() => setEdit({ title: "", description: "", course_id: "", teacher_name: "", scheduled_at: toLocal(new Date(Date.now() + 3600000).toISOString()), duration_minutes: 60, join_url: "", recording_url: "" })}>
          <Plus className="mr-1.5 h-4 w-4" /> Schedule class
        </Button>
      }
    >
      {lives.isLoading ? <LoadingState /> : !lives.data?.length ? <EmptyState title="No live classes yet" /> : (
        <div className="grid gap-2">
          {lives.data.map((l) => {
            const st = liveStatus(l.scheduled_at, l.duration_minutes);
            return (
              <div key={l.id} className="surface-card flex flex-wrap items-center gap-2 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(l.scheduled_at)} · {l.duration_minutes} min · {l.courses?.title ?? "All students"}</p>
                </div>
                <Badge variant={st === "live" ? "destructive" : st === "upcoming" ? "default" : "secondary"}>{st}</Badge>
                <Button size="icon" variant="ghost" onClick={() => setEdit({ ...l, scheduled_at: toLocal(l.scheduled_at) })} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => del(l.id, l.title)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit live class" : "Schedule live class"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <Field label="Title"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="Course">
                <NativeSelect value={edit.course_id ?? ""} onChange={(e) => setEdit({ ...edit, course_id: e.target.value })}>
                  <option value="">All students</option>
                  {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Teacher"><Input value={edit.teacher_name ?? ""} onChange={(e) => setEdit({ ...edit, teacher_name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Date & time"><Input type="datetime-local" value={edit.scheduled_at} onChange={(e) => setEdit({ ...edit, scheduled_at: e.target.value })} /></Field>
                <Field label="Duration (min)"><Input type="number" min={1} value={edit.duration_minutes} onChange={(e) => setEdit({ ...edit, duration_minutes: Number(e.target.value) })} /></Field>
              </div>
              <Field label="Join link (Zoom / Meet / YouTube Live)"><Input value={edit.join_url ?? ""} onChange={(e) => setEdit({ ...edit, join_url: e.target.value })} placeholder="https://" /></Field>
              <Field label="Description"><Textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              <Field label="Recording (after class)">
                <MediaInput kind="video" folder="recordings" value={edit.recording_url ?? ""} onChange={(v) => setEdit((x) => (x ? { ...x, recording_url: v } : x))} />
              </Field>
              <Button className="w-full" onClick={save} disabled={!edit.title.trim()}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
