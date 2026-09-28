import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { MediaInput } from "@/components/MediaInput";
import { LoadingState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, NativeSelect, run, confirmDelete, notifyAll } from "@/lib/admin-ui";

export const Route = createFileRoute("/_authenticated/admin/notes")({
  head: () => ({ meta: [{ title: "PDFs & notes — JK Academy Admin" }, { name: "description", content: "Upload PDFs and notes for students." }] }),
  component: AdminNotes,
});

function AdminNotes() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", course_id: "", file_url: "", allow_download: true });
  const [search, setSearch] = useState("");

  const courses = useQuery({
    queryKey: ["admin-course-options"],
    queryFn: async () => (await supabase.from("courses").select("id, title").order("title")).data ?? [],
  });
  const notes = useQuery({
    queryKey: ["admin-notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("*, courses(title)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function save() {
    if (!form.title.trim() || !form.file_url) return;
    const ok = await run(
      supabase.from("notes").insert({
        title: form.title.trim(),
        course_id: form.course_id || null,
        file_url: form.file_url,
        allow_download: form.allow_download,
      }),
    );
    if (ok) {
      await notifyAll(supabase, `New notes: ${form.title.trim()}`, "notes", "/notes");
      setForm({ title: "", course_id: "", file_url: "", allow_download: true });
      qc.invalidateQueries({ queryKey: ["admin-notes"] });
    }
  }

  async function toggle(id: string, allow_download: boolean) {
    if (await run(supabase.from("notes").update({ allow_download }).eq("id", id))) qc.invalidateQueries({ queryKey: ["admin-notes"] });
  }
  async function del(id: string, t: string) {
    if (confirmDelete(`"${t}"`) && (await run(supabase.from("notes").delete().eq("id", id), "Deleted"))) qc.invalidateQueries({ queryKey: ["admin-notes"] });
  }

  const list = (notes.data ?? []).filter((n) => n.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminShell title="PDFs & notes" subtitle="Uploaded notes appear on the students' Notes page">
      <div className="surface-card mb-6 grid gap-3 p-4 md:grid-cols-2">
        <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Course (optional)">
          <NativeSelect value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
            <option value="">All students</option>
            {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </NativeSelect>
        </Field>
        <div className="md:col-span-2">
          <Field label="PDF file"><MediaInput kind="pdf" folder="notes" value={form.file_url} onChange={(v) => setForm((f) => ({ ...f, file_url: v }))} /></Field>
        </div>
        <div className="flex items-center gap-2 text-sm"><Switch checked={form.allow_download} onCheckedChange={(v) => setForm({ ...form, allow_download: v })} /> Allow download</div>
        <Button onClick={save} disabled={!form.title.trim() || !form.file_url}><Plus className="mr-1.5 h-4 w-4" /> Add note</Button>
      </div>

      <Input placeholder="Search notes…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 max-w-sm" />
      {notes.isLoading ? <LoadingState /> : list.length === 0 ? <EmptyState title="No notes yet" /> : (
        <div className="grid gap-2">
          {list.map((n) => (
            <div key={n.id} className="surface-card flex flex-wrap items-center gap-2 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.courses?.title ?? "All students"}</p>
              </div>
              <label className="flex items-center gap-1 text-xs"><Switch checked={n.allow_download} onCheckedChange={(v) => toggle(n.id, v)} /> Download</label>
              <Button size="icon" variant="ghost" asChild><a href={n.file_url} target="_blank" rel="noreferrer" aria-label="Open"><ExternalLink className="h-4 w-4" /></a></Button>
              <Button size="icon" variant="ghost" onClick={() => del(n.id, n.title)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
