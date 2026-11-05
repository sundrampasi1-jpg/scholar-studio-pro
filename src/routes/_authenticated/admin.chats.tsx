import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { SupportChat } from "@/components/SupportChat";
import { LoadingState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/chats")({
  head: () => ({ meta: [{ title: "Student chats — JK Academy Admin" }, { name: "description", content: "Read and reply to student help chats." }] }),
  component: AdminChats,
});

function AdminChats() {
  const { user } = useAuth();
  const [active, setActive] = useState<string | null>(null);
  const qc = useQueryClient();
  const ai = useQuery({
    queryKey: ["ai-chat-enabled"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("id, ai_chat_enabled").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  async function toggleAi(v: boolean) {
    if (!ai.data) return;
    const { error } = await supabase.from("app_settings").update({ ai_chat_enabled: v }).eq("id", ai.data.id);
    if (error) { toast.error(error.message); return; }
    toast.success(v ? "AI replies ON" : "AI replies OFF");
    await qc.invalidateQueries({ queryKey: ["ai-chat-enabled"] });
  }
  const threads = useQuery({
    queryKey: ["admin-chat-threads"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("support_messages").select("student_id, body, from_staff, is_ai, created_at").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      const latest = new Map<string, (typeof data)[number]>();
      for (const m of data) if (!latest.has(m.student_id)) latest.set(m.student_id, m);
      const ids = [...latest.keys()];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      return ids.map((id) => ({ id, last: latest.get(id)!, profile: profs?.find((p) => p.id === id) }));
    },
  });

  return (
    <AdminShell title="Student chats" subtitle="Messages from the Help page">
      <div className="mb-4 flex items-center justify-between rounded-md border bg-card p-3">
        <div>
          <p className="text-sm font-medium">AI auto-reply (Gemini)</p>
          <p className="text-xs text-muted-foreground">When ON, AI instantly answers student text and voice messages. You can still reply manually.</p>
        </div>
        <Switch checked={!!ai.data?.ai_chat_enabled} disabled={!ai.data} onCheckedChange={(v) => void toggleAi(v)} />
      </div>
      {threads.isLoading ? <LoadingState /> : !threads.data?.length ? <EmptyState title="No chats yet" /> : (
        <div className="grid w-full min-w-0 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-1">
            {threads.data.map((t) => (
              <button key={t.id} onClick={() => setActive(t.id)}
                className={`w-full rounded-md border p-3 text-left text-sm ${active === t.id ? "border-primary bg-accent" : "bg-card"}`}>
                <p className="font-medium">{t.profile?.full_name || t.profile?.email || "Student"}</p>
                <p className="truncate text-xs text-muted-foreground">{t.last.from_staff ? (t.last.is_ai ? "AI: " : "You: ") : ""}{t.last.body}</p>
                <p className="text-[10px] text-muted-foreground">{formatDateTime(t.last.created_at)}{!t.last.from_staff && " · awaiting reply"}</p>
              </button>
            ))}
          </div>
          <div className="w-full min-w-0 max-w-full overflow-hidden">{active && user ? <SupportChat studentId={active} senderId={user.id} asStaff /> : <p className="text-sm text-muted-foreground">Pick a chat to reply.</p>}</div>
        </div>
      )}
    </AdminShell>
  );
        }
