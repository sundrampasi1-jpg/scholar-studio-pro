import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/queries";

/** One chat thread between a student and the institute. Staff reply with asStaff. */
export function SupportChat({ studentId, senderId, asStaff }: { studentId: string; senderId: string; asStaff?: boolean }) {
  const qc = useQueryClient();
  const key = ["support-chat", studentId];
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const msgs = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`support-${studentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `student_id=eq.${studentId}` }, () =>
        qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.data?.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({ student_id: studentId, sender_id: senderId, body, from_staff: !!asStaff });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (asStaff) {
      await supabase.from("notifications").insert({ user_id: studentId, title: "New reply from JK Academy", body: body.slice(0, 120), type: "chat", link: "/help" });
    }
    setText("");
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="flex flex-col rounded-lg border bg-card">
      <div className="h-80 space-y-2 overflow-y-auto p-3">
        {msgs.isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
        {msgs.data?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>}
        {msgs.data?.map((m) => {
          const mine = m.from_staff === !!asStaff;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-1 text-[10px] opacity-70">{m.from_staff ? "JK Academy" : "Student"} · {formatDateTime(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 border-t p-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder="Type your message…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <Button onClick={send} disabled={sending || !text.trim()} aria-label="Send">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
