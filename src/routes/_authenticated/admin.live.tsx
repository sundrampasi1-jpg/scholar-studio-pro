import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { LiveClassRoom } from "@/components/LiveClassRoom";
import { LiveClassChat } from "@/components/LiveClassChat";
import { startLiveClass, endLiveClass } from "@/lib/live-class.functions";

export const Route = createFileRoute("/_authenticated/admin/live")({
  head: () => ({ meta: [{ title: "Live classes — JK Academy Admin" }, { name: "description", content: "Schedule live classes and add recordings." }] }),
  component: AdminLive,
});

type Live = {
  id?: string;
  title: string;
  description: string | null;
  course_id: string | null;
  batch_id: string | null;
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
  const startLive = useServerFn(startLiveClass);
  const finishLive = useServerFn(endLiveClass);
  const [edit, setEdit] = useState<Live | null>(null);
  const [activeHostId, setActiveHostId] = useState<string | null>(null);
  const [busyLiveId, setBusyLiveId] = useState<string | null>(null);

  async function startCameraLive(id: string) {
    setBusyLiveId(id);
    try {
      await startLive({ data: { liveClassId: id } });
      setActiveHostId(id);
      await qc.invalidateQueries({ queryKey: ["admin-live"] });
      toast.success("Live class started. Camera studio is opening.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start live class.");
    } finally {
      setBusyLiveId(null);
    }
  }

  async function stopCameraLive(id: string) {
    setBusyLiveId(id);
    try {
      await finishLive({ data: { liveClassId: id } });
      setActiveHostId(null);
      await qc.invalidateQueries({ queryKey: ["admin-live"] });
      toast.success("Live class ended.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not end live class.");
    } finally {
      setBusyLiveId(null);
    }
  }
  const courses = useQuery({
    queryKey: ["admin-course-options"],
    queryFn: async () => (await supabase.from("courses").select("id, title").order("title")).data ?? [],
  });
  const batches = useQuery({
    queryKey: ["admin-live-batch-options"],
    queryFn: async () => (await supabase.from("batches").select("id, name, course_id, validity_days").eq("is_active", true).order("name")).data ?? [],
  });
  const lives = useQuery({
    queryKey: ["admin-live"],
    queryFn: async () => {
      const { data, error } = await supabase.from("live_classes").select("*, courses(title), batches(name, validity_days)").order("scheduled_at", { ascending: false });
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
      batch_id: edit.batch_id || null,
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
      if (!edit.id) {
        const message = `Live class scheduled: ${row.title} (${formatDateTime(row.scheduled_at)})`;
        if (row.batch_id) {
          const { data: enrolled } = await supabase.from("enrollments").select("user_id").eq("batch_id", row.batch_id).eq("status", "active").gt("expires_at", new Date().toISOString());
          if (enrolled?.length) await supabase.from("notifications").insert(enrolled.map((student) => ({ user_id: student.user_id, title: "New batch live class", body: message, type: "live", link: "/live" })));
        } else {
          await notifyAll(supabase, message, "live", "/live");
        }
      }
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
        <Button onClick={() => setEdit({ title: "", description: "", course_id: "", batch_id: "", teacher_name: "", scheduled_at: toLocal(new Date(Date.now() + 3600000).toISOString()), duration_minutes: 60, join_url: "", recording_url: "" })}>
          <Plus className="mr-1.5 h-4 w-4" /> Schedule class
        </Button>
      }
    >
      {lives.isLoading ? <LoadingState /> : !lives.data?.length ? <EmptyState title="No live classes yet" /> : (
        <div className="grid gap-2">
          {lives.data.map((l) => {
            const st = l.live_status === "live" ? "live" : l.live_status === "ended" ? "completed" : liveStatus(l.scheduled_at, l.duration_minutes);
            return (
              <div key={l.id} className="surface-card rounded-2xl p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(l.scheduled_at)} · {l.duration_minutes} min · {l.courses?.title ?? "All students"}
                      {l.batches?.name ? " · Batch: " + l.batches.name + " · " + l.batches.validity_days + " days validity" : ""}
                    </p>
                  </div>
                  <Badge variant={st === "live" ? "destructive" : st === "upcoming" ? "default" : "secondary"}>{st === "live" ? "LIVE NOW" : st}</Badge>
                  {l.live_status === "live" ? (
                    <>
                      {activeHostId !== l.id && <Button size="sm" variant="outline" onClick={() => setActiveHostId(l.id)}>Open studio</Button>}
                      <Button size="sm" variant="destructive" disabled={busyLiveId === l.id} onClick={() => void stopCameraLive(l.id)}>End live</Button>
                    </>
                  ) : l.live_status !== "ended" ? (
                    <Button size="sm" onClick={() => void startCameraLive(l.id)} disabled={busyLiveId === l.id}>
                      {busyLiveId === l.id ? "Starting…" : "Start camera live"}
                    </Button>
                  ) : null}
                  <Button size="icon" variant="ghost" onClick={() => setEdit({ ...l, scheduled_at: toLocal(l.scheduled_at) })} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(l.id, l.title)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                </div>
                {activeHostId === l.id && l.live_status === "live" && (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <LiveClassRoom liveClassId={l.id} mode="host" />
                    <LiveClassChat liveClassId={l.id} mode="admin" />
                  </div>
                )}
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
                <NativeSelect value={edit.course_id ?? ""} onChange={(e) => setEdit({ ...edit, course_id: e.target.value, batch_id: "" })}>
                  <option value="">All courses</option>
                  {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Batch (optional — restricts class to this batch)">
                <NativeSelect value={edit.batch_id ?? ""} onChange={(e) => { const selected = batches.data?.find((b) => b.id === e.target.value); setEdit({ ...edit, batch_id: e.target.value, course_id: selected?.course_id ?? edit.course_id }); }}>
                  <option value="">All eligible students in course</option>
                  {batches.data?.filter((b) => !edit.course_id || b.course_id === edit.course_id).map((b) => <option key={b.id} value={b.id}>{b.name} · {b.validity_days} days access</option>)}
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
