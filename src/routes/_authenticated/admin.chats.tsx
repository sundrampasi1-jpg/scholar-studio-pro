import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  const threads = useQuery({
    queryKey: ["admin-chat-threads"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("support_messages").select("student_id, body, from_staff, created_at").order("created_at", { ascending: false }).limit(1000);
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
      {threads.isLoading ? <LoadingState /> : !threads.data?.length ? <EmptyState title="No chats yet" /> : (
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <div className="space-y-1">
            {threads.data.map((t) => (
              <button key={t.id} onClick={() => setActive(t.id)}
                className={`w-full rounded-md border p-3 text-left text-sm ${active === t.id ? "border-primary bg-accent" : "bg-card"}`}>
                <p className="font-medium">{t.profile?.full_name || t.profile?.email || "Student"}</p>
                <p className="truncate text-xs text-muted-foreground">{t.last.from_staff ? "You: " : ""}{t.last.body}</p>
                <p className="text-[10px] text-muted-foreground">{formatDateTime(t.last.created_at)}{!t.last.from_staff && " · awaiting reply"}</p>
              </button>
            ))}
          </div>
          <div>{active && user ? <SupportChat studentId={active} senderId={user.id} asStaff /> : <p className="text-sm text-muted-foreground">Pick a chat to reply.</p>}</div>
        </div>
      )}
    </AdminShell>
  );
}
