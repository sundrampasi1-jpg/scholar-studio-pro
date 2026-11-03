import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/queries";

type SupportChatProps = {
  studentId: string;
  senderId: string;
  asStaff?: boolean;
  fullHeight?: boolean;
};

export function SupportChat({
  studentId,
  senderId,
  asStaff,
  fullHeight,
}: SupportChatProps) {
  const qc = useQueryClient();
  const key = ["support-chat", studentId];

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`support-${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_messages",
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: key });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [studentId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.data?.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);

    const { error } = await supabase.from("support_messages").insert({
      student_id: studentId,
      sender_id: senderId,
      body,
      from_staff: !!asStaff,
    });

    setSending(false);

    if (error) {
      toast.error(`Message send nahi hua: ${error.message}`);
      return;
    }

    if (asStaff) {
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          user_id: studentId,
          title: "New reply from JK Academy",
          body: body.slice(0, 120),
          type: "chat",
          link: "/help",
        });

      if (notificationError) {
        toast.error("Message send ho gaya, lekin notification nahi bheji gayi.");
      }
    }

    setText("");
    await qc.invalidateQueries({ queryKey: key });
    toast.success("Message sent");
  }

  function startEdit(message: {
    id: string;
    body: string;
    sender_id: string;
    from_staff: boolean;
  }) {
    if (
      message.sender_id !== senderId ||
      message.from_staff !== !!asStaff
    ) {
      toast.error("Aap sirf apne messages edit kar sakte hain.");
      return;
    }

    setEditingId(message.id);
    setEditText(message.body);
  }

  async function saveEdit(message: {
    id: string;
    sender_id: string;
    from_staff: boolean;
  }) {
    const body = editText.trim();

    if (!body) {
      toast.error("Message khaali nahi ho sakta.");
      return;
    }

    if (
      message.sender_id !== senderId ||
      message.from_staff !== !!asStaff
    ) {
      toast.error("Aap sirf apne messages edit kar sakte hain.");
      return;
    }

    setSavingEdit(true);

    const { data, error } = await supabase
      .from("support_messages")
      .update({ body })
      .eq("id", message.id)
      .eq("student_id", studentId)
      .eq("sender_id", senderId)
      .eq("from_staff", !!asStaff)
      .select("id");

    setSavingEdit(false);

    if (error) {
      toast.error(`Edit nahi hua: ${error.message}`);
      return;
    }

    if (!data?.length) {
      toast.error("Edit nahi hua. Supabase permissions check karein.");
      return;
    }

    setEditingId(null);
    setEditText("");
    await qc.invalidateQueries({ queryKey: key });
    toast.success("Message updated");
  }

  async function deleteMessage(message: {
    id: string;
    sender_id: string;
    from_staff: boolean;
  }) {
    if (
      message.sender_id !== senderId ||
      message.from_staff !== !!asStaff
    ) {
      toast.error("Aap sirf apne messages delete kar sakte hain.");
      return;
    }

    if (!window.confirm("Kya aap ye message delete karna chahte hain?")) {
      return;
    }

    setDeletingId(message.id);

    const { data, error } = await supabase
      .from("support_messages")
      .delete()
      .eq("id", message.id)
      .eq("student_id", studentId)
      .eq("sender_id", senderId)
      .eq("from_staff", !!asStaff)
      .select("id");

    setDeletingId(null);

    if (error) {
      toast.error(`Delete nahi hua: ${error.message}`);
      return;
    }

    if (!data?.length) {
      toast.error("Delete nahi hua. Supabase permissions check karein.");
      return;
    }

    if (editingId === message.id) {
      setEditingId(null);
      setEditText("");
    }

    await qc.invalidateQueries({ queryKey: key });
    toast.success("Message deleted");
  }

  return (
    <div className={fullHeight ? "flex h-full flex-col rounded-lg border bg-card" : "flex flex-col rounded-lg border bg-card"}>
      <div className={fullHeight ? "flex-1 min-h-0 space-y-3 overflow-y-auto p-3" : "h-80 space-y-3 overflow-y-auto p-3"}>
        {msgs.isLoading && (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        )}

        {msgs.isError && (
          <div className="text-center text-sm text-destructive">
            Messages load nahi hue.
            <Button
              size="sm"
              variant="outline"
              className="ml-2"
              onClick={() => void msgs.refetch()}
            >
              Retry
            </Button>
          </div>
        )}

        {msgs.data?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Say hello!
          </p>
        )}

        {msgs.data?.map((m) => {
          const mine = m.sender_id === senderId &&
            m.from_staff === !!asStaff;
          const isEditing = editingId === m.id;
          const isDeleting = deletingId === m.id;

          return (
            <div
              key={m.id}
              className={mine ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      disabled={savingEdit}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingEdit}
                        onClick={() => {
                          setEditingId(null);
                          setEditText("");
                        }}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={savingEdit || !editText.trim()}
                        onClick={() => void saveEdit(m)}
                      >
                        {savingEdit ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-1 h-4 w-4" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                )}

                <p className="mt-1 text-[10px] opacity-70">
                  {m.from_staff ? "JK Academy" : "Student"} ·{" "}
                  {formatDateTime(m.created_at)}
                </p>

                {mine && !isEditing && (
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-black/10"
                      onClick={() => startEdit(m)}
                      aria-label="Edit message"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-black/10 disabled:opacity-50"
                      onClick={() => void deleteMessage(m)}
                      aria-label="Delete message"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      <div className="flex gap-2 border-t p-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Type your message…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button
          onClick={() => void send()}
          disabled={sending || !text.trim()}
          aria-label="Send"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
