import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, MessageCircleQuestion } from "lucide-react";
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

  const replyAiFn = useServerFn(replyDoubtAi);

  const askAi = useMutation({
    mutationFn: async (doubtId: string) => replyAiFn({ data: { doubtId } }),
    onSuccess: (res: { ok: boolean; error?: string; skipped?: boolean }) => {
      if (res.ok) toast.success("AI ne aapke doubt ka jawab de diya");
      else if (!res.skipped) toast.error(res.error ?? "AI reply nahi de paya");
      qc.invalidateQueries({ queryKey: ["my-doubts"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
      const { data, error } = await supabase
        .from("doubts")
        .insert({
          user_id: user!.id,
          title: parsed.data.title,
          body: parsed.data.body,
          course_id: courseId || null,
          image_url,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (doubtId: string) => {
      toast.success("Doubt submitted");
      setTitle("");
      setBody("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["my-doubts"] });
      askAi.mutate(doubtId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <StudentShell title="Doubts" subtitle="Ask your teachers anything">
      <div className="mx-auto grid min-w-0 max-w-5xl gap-5">
        <section className="overflow-hidden rounded-3xl border border-[#E8DCCB] bg-white p-0 shadow-[0_10px_30px_rgba(91,64,34,0.08)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E9DDCA] bg-white px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#49351F]">My Doubts</h2>
              <p className="mt-0.5 text-xs text-[#927D69]">Your questions and their replies</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#EBD9BC] bg-white text-[#A87937] shadow-sm">
              <MessageCircleQuestion className="h-5 w-5" />
            </div>
          </div>
          {doubts.isLoading ? (
            <LoadingState />
          ) : (doubts.data ?? []).length === 0 ? (
            <div className="mx-4 my-4 rounded-2xl border border-dashed border-[#DECBAF] bg-[#FFFCF8] px-4 py-8 text-center">
              <MessageCircleQuestion className="mx-auto mb-2 h-8 w-8 text-[#B58A55]" />
              <p className="font-semibold text-[#5C452B]">No doubts yet</p>
              <p className="mt-1 text-xs text-[#927D69]">Apna pehla question neeche submit karein.</p>
            </div>
          ) : (
            <div className="bg-white">
              {(doubts.data ?? []).map((d, index) => (
                <div key={d.id}>
                <article className="bg-white px-4 py-4 sm:px-5 sm:py-5">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words font-bold text-[#49351F]">{d.title}</h3>
                      <p className="mt-1 text-[11px] text-[#958675]">{d.courses?.title ?? "General"} · {formatDateTime(d.created_at)}</p>
                    </div>
                    <Badge className="rounded-full border border-[#242424] bg-[#292929] px-3 text-white hover:bg-[#292929]" variant="outline">{d.status}</Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <div className="max-w-[92%] rounded-[20px] rounded-br-md bg-[#4389C7] px-4 py-3 text-white shadow-sm sm:max-w-[84%]">
                        <p className="mb-1.5 text-[10px] font-black tracking-[0.14em] text-[#F5DDAF]">MY DOUBT</p>
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{d.body}</p>
                        {d.image_url && <img src={d.image_url} alt="Doubt attachment" className="mt-2 max-h-56 max-w-full rounded-xl border border-white/30 object-contain" />}
                        <p className="mt-2 text-right text-[10px] text-[#E5F2FF]">You · {formatDateTime(d.created_at)}</p>
                      </div>
                    </div>
                    {(d.doubt_replies ?? []).map((r) => (
                      <div key={r.id} className="flex justify-start">
                        <div className="max-w-[96%] rounded-[20px] rounded-bl-md border-[1.5px] border-[#CDB58F] bg-white px-4 py-3 text-[#34404B] shadow-[0_3px_10px_rgba(91,64,34,0.06)] sm:max-w-[88%]">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#F5E9D7] text-[#A87937]"><GraduationCap className="h-4 w-4" /></span>
                            <span className="text-xs font-bold tracking-wide text-[#76552D]">Teacher</span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{r.body}</p>
                          <p className="mt-2 text-[10px] text-[#958B80]">{formatDateTime(r.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    {!(d.doubt_replies ?? []).some((r) => r.is_ai) && (
                      <div className="flex justify-start pl-1">
                        <Button size="sm" variant="outline" className="rounded-full border-[#E5D5BE] bg-[#FFFCF7] text-xs text-[#805D32] hover:bg-[#F8F0E5]" disabled={askAi.isPending && askAi.variables === d.id} onClick={() => askAi.mutate(d.id)}>
                          {askAi.isPending && askAi.variables === d.id ? "Reply aa raha hai…" : "Get reply"}
                        </Button>
                      </div>
                    )}
                  </div>
                </article>
                {index < (doubts.data ?? []).length - 1 && <div className="h-[5px] bg-[#F1E6D6]" />}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[#E9DCC9] bg-gradient-to-br from-[#FFFDF9] via-[#FFF9F0] to-[#F6EBDD] p-4 shadow-[0_8px_28px_rgba(115,78,34,0.07)] sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F5E9D7] text-[#A87937]"><MessageCircleQuestion className="h-5 w-5" /></div>
            <div>
              <h2 className="font-extrabold text-[#49351F]">Ask a New Doubt</h2>
              <p className="text-xs text-[#927D69]">Apna question likhein, hum help karenge</p>
            </div>
          </div>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#75502A]">Course (optional)</Label>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="h-11 w-full rounded-xl border border-[#E8DCCB] bg-[#FFFCF7] px-3 text-sm text-[#49351F] outline-none focus:border-[#B9874C]">
                <option value="">General</option>
                {(courses.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#75502A]">Question title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Damodar Nadi ka udgam" className="h-11 rounded-xl border-[#E8DCCB] bg-[#FFFCF7]"/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#75502A]">Your doubt</Label>
              <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Apna question detail mein likhein..." className="min-h-28 resize-y rounded-xl border-[#E8DCCB] bg-[#FFFCF7] leading-relaxed"/>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <Label className="text-xs font-semibold text-[#75502A]">Attach image (optional)</Label>
                <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-10 max-w-full rounded-xl border-[#E8DCCB] bg-[#FFFCF7] text-xs"/>
              </div>
              {file && <span className="max-w-36 truncate text-[11px] text-[#806039]">{file.name}</span>}
            </div>
            <Button type="submit" className="h-11 w-full rounded-xl bg-gradient-to-r from-[#A96F2B] to-[#C18A45] font-bold text-white shadow-md hover:brightness-105" disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit Doubt"}
            </Button>
          </form>
        </section>
      </div>
    </StudentShell>
  );
}
