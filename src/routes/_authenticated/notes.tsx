import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText, X } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "Notes & PDFs — JK Academy" },
      { name: "description", content: "Study notes and PDFs organised by course and chapter." },
      { property: "og:title", content: "Notes & PDFs — JK Academy" },
      { property: "og:description", content: "Study notes and PDFs organised by course and chapter." },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<{ title: string; url: string; download: boolean } | null>(null);

  const notes = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*, courses(title), subjects(name), chapters(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list = (notes.data ?? []).filter((n) => n.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <StudentShell title="Notes & PDFs">
      {viewing && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="truncate font-medium">{viewing.title}</p>
            <div className="flex gap-2">
              {viewing.download && (
                <Button size="sm" variant="outline" onClick={() => downloadFile(viewing.url, viewing.title)}>
                  <Download className="mr-1.5 h-4 w-4" /> Download
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => setViewing(null)} aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <PdfViewer url={viewing.url} className="flex-1 overflow-y-auto bg-surface p-3" />
        </div>
      )}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search notes…"
        className="mb-4 max-w-sm"
      />
      {notes.isLoading ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <EmptyState title="No notes yet" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((n) => (
            <div key={n.id} className="surface-card flex items-center gap-3 p-4">
              <FileText className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{n.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[n.courses?.title, n.subjects?.name, n.chapters?.name].filter(Boolean).join(" › ") ||
                    "General"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setViewing({ title: n.title, url: n.file_url, download: n.allow_download })}
              >
                View
              </Button>
            </div>
          ))}
        </div>
      )}
    </StudentShell>
  );
}
