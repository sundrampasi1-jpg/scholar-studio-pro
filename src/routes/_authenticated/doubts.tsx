import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { replyDoubtAi } from "@/lib/ai-chat.functions";
import { z } from "zod";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadMedia } from "@/lib/upload";
import { formatDateTime } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/doubts")({
  head: () => ({
    meta: [
      { title: "Doubts — JK Academy" },
      { name: "description", content: "Ask doubts and get replies from teachers." },
      { property: "og:title", content: "Doubts — JK Academy" },
      { property: "og:description", content: "Ask doubts and get replies from teachers." },
    ],
  }),
  component: DoubtsPage,
});

const schema = z.object({
  title: z.string().trim().min(3, "Add a short title").max(150),
  body: z.string().trim().min(3, "Describe your doubt").max(3000),
});

function DoubtsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courseId, setCourseId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const courses = useQuery({
    queryKey: ["courses-min"],
    queryFn: async () => (await supabase.from("courses").select("id,title")).data ?? [],
  });

  const doubts = useQuery({
    queryKey: ["my-doubts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doubts")
        .select("*, courses(title), doubt_replies(id, body, created_at, user_id, is_ai)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ title, body });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      let image_url: string | null = null;
      if (file) {
        if (!file.type.startsWith("image/")) throw new Error("Attach an image file");
        if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
        image_url = await uploadMedia(file, `doubts/${user!.id}`);
      }
      const { error } = await supabase.from("doubts").insert({
        user_id: user!.id,
        title: parsed.data.title,
        body: parsed.data.body,
        course_id: courseId || null,
        image_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Doubt submitted");
      setTitle("");
      setBody("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["my-doubts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <StudentShell title="Doubts" subtitle="Ask your teachers anything">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form
          className="surface-card h-fit space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <h2 className="font-semibold">Ask a new doubt</h2>
          <div className="space-y-1.5">
            <Label>Course (optional)</Label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">General</option>
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Details</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Image (optional)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button type="submit" className="w-full" disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit doubt"}
          </Button>
        </form>

        <div>
          <h2 className="mb-3 font-semibold">My doubts</h2>
          {doubts.isLoading ? (
            <LoadingState />
          ) : (doubts.data ?? []).length === 0 ? (
            <EmptyState title="No doubts yet" />
          ) : (
            <div className="space-y-3">
              {(doubts.data ?? []).map((d) => (
                <div key={d.id} className="surface-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.courses?.title ?? "General"} · {formatDateTime(d.created_at)}
                      </p>
                    </div>
                    <Badge variant={d.status === "resolved" ? "default" : "secondary"}>{d.status}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{d.body}</p>
                  {d.image_url && (
                    <img src={d.image_url} alt="Doubt attachment" className="mt-2 max-h-60 rounded-md border" />
                  )}
                  {(d.doubt_replies ?? []).length > 0 && (
                    <div className="mt-3 space-y-2 border-l-2 border-primary pl-3">
                      {d.doubt_replies.map((r) => (
                        <div key={r.id}>
                          <p className="text-sm">{r.body}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.user_id === user?.id ? "You" : "Teacher"} · {formatDateTime(r.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentShell>
  );
}
