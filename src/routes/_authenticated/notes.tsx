import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText, X } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PdfViewer, downloadFile } from "@/components/PdfViewer";

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

  async function openNote(n: { title: string; file_url: string; allow_download: boolean }) {
    const raw = n.file_url;
    const path = raw.includes("/object/public/media/")
      ? raw.split("/object/public/media/")[1]
      : raw.includes("/object/sign/media/")
      ? raw.split("/object/sign/media/")[1].split("?")[0]
      : raw;
    const { data, error } = await supabase.storage.from("media").createSignedUrl(path, 3600);
    if (error || !data) {
      alert("Could not open this file.");
      return;
    }
    setViewing({ title: n.title, url: data.signedUrl, download: n.allow_download });
  }

  return (
    <StudentShell title="Notes & PDFs">
      {viewing && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="truncate font-medium">{viewing.title}</p>
            <div className="flex gap-2">
              {viewing.download && (
                <Butto
