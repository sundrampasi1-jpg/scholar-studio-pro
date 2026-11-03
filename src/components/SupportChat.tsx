import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Send,
  Pencil,
  Trash2,
  Check,
  X,
  Paperclip,
  Smile,
  Mic,
  Square,
  Play,
  Pause,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/queries";
import { uploadMedia } from "@/lib/upload";

type SupportChatProps = {
  studentId: string;
  senderId: string;
  asStaff?: boolean;
  fullHeight?: boolean;
};

const QUICK_EMOJIS = ["😀", "😂", "🙏", "👍", "❤️", "🎉", "😊", "🤔", "👏", "🔥"];

function isImageUrl(text: string) {
  return /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(text.trim());
}
function isAudioUrl(text: string) {
  return /^https?:\/\/\S+\.(webm|ogg|mp3|m4a|wav)(\?\S*)?$/i.test(text.trim());
}

function VoiceNoteBubble({ src, mine }: { src: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else void el.play();
  }

  function fmt(s: number) {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  return (
    <div className="flex min-w-[150px] items-center gap-2 py-0.5">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        className="hidden"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          mine ? "bg-primary-foreground/20" : "bg-primary/15"
        }`}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-current/20">
        <div
          className="h-full rounded-full bg-current/60"
          style={{ width: duration ? `${(current / duration) * 100}%` : "0%" }}
        />
      </div>
      <span className="shrink-0 text-[10px] opacity-80">{fmt(playing || current ? current : duration)}</span>
    </div>
  );
}

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
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        { event: "*", schema: "public", table: "support_messages", filter: `student_id=eq.${studentId}` },
        () => void qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [studentId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.data?.length]);

  useEffect(() => {
    return () => {
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  // Close the long-press action menu on any outside tap.
  useEffect(() => {
    if (!menuFor) return;
    function close() {
      setMenuFor(null);
    }
    window.addEventListener("click", close);
    window.addEventListener("touchstart", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("touchstart", close);
    };
  }, [menuFor]);

  async function sendBody(body: string) {
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
      const { error: notificationError } = await supabase.from("notifications").insert({
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

    await qc.invalidateQueries({ queryKey: key });
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    setShowEmoji(false);
    await sendBody(body);
  }

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setUploadingAttachment(true);
    try {
      const url = await uploadMedia(file, `chat-attachments/${senderId}`);
      await sendBody(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo could not be sent");
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      recordedChunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };
      rec.onstop = () => stream.getTracks().forEach((t) => t.stop());
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Could not access microphone. Check app permissions.");
    }
  }

  function cancelRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recorderRef.current?.stop();
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordedChunks.current = [];
    setRecording(false);
    setRecordSeconds(0);
  }

  async function stopAndSendRecording() {
    const rec = recorderRef.current;
    if (!rec) return;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecording(false);

    const finished = new Promise<void>((resolve) => {
      rec.addEventListener("stop", () => resolve(), { once: true });
    });
    rec.stop();
    await finished;

    if (recordSeconds < 1) {
      recordedChunks.current = [];
      setRecordSeconds(0);
      return;
    }

    const blob = new Blob(recordedChunks.current, { type: "audio/webm" });
    recordedChunks.current = [];
    setRecordSeconds(0);

    setUploadingVoice(true);
    try {
      const url = await uploadMedia(blob, `chat-attachments/${senderId}`, `voice-${Date.now()}.webm`);
      await sendBody(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice message could not be sent");
    } finally {
      setUploadingVoice(false);
    }
  }

  function startEdit(message: { id: string; body: string; sender_id: string; from_staff: boolean }) {
    if (message.sender_id !== senderId || message.from_staff !== !!asStaff) {
      toast.error("Aap sirf apne messages edit kar sakte hain.");
      return;
    }
    if (isImageUrl(message.body) || isAudioUrl(message.body)) {
      toast.error("Ye edit nahi ho sakta. Aap ise delete kar sakte hain.");
      return;
    }
    setMenuFor(null);
    setEditingId(message.id);
    setEditText(message.body);
  }

  async function saveEdit(message: { id: string; sender_id: string; from_staff: boolean }) {
    const body = editText.trim();
    if (!body) {
      toast.error("Message khaali nahi ho sakta.");
      return;
    }
    if (message.sender_id !== senderId || message.from_staff !== !!asStaff) {
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
  }

  async function deleteMessage(message: { id: string; sender_id: string; from_staff: boolean }) {
    if (message.sender_id !== senderId || message.from_staff !== !!asStaff) {
      toast.error("Aap sirf apne messages delete kar sakte hain.");
      return;
    }
    setMenuFor(null);
    if (!window.confirm("Kya aap ye message delete karna chahte hain?")) return;

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
  }

  function fmtTimer(s: number) {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  // Long-press handling — only for the viewer's own messages.
  function pressStart(mine: boolean, id: string) {
    if (!mine) return;
    pressTimerRef.current = setTimeout(() => setMenuFor(id), 450);
  }
  function pressEnd() {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  }

  return (
    <div className={fullHeight ? "flex h-full flex-col rounded-lg border bg-card" : "flex flex-col rounded-lg border bg-card"}>
      <div className={fullHeight ? "flex-1 min-h-0 space-y-2 overflow-y-auto p-3" : "h-80 space-y-2 overflow-y-auto p-3"}>
        {msgs.isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}

        {msgs.isError && (
          <div className="text-center text-sm text-destructive">
            Messages load nahi hue.
            <Button size="sm" variant="outline" className="ml-2" onClick={() => void msgs.refetch()}>
              Retry
            </Button>
          </div>
        )}

        {msgs.data?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>
        )}

        {msgs.data?.map((m) => {
          const mine = m.sender_id === senderId && m.from_staff === !!asStaff;
          const isEditing = editingId === m.id;
          const isDeleting = deletingId === m.id;
          const isImage = isImageUrl(m.body);
          const isAudio = isAudioUrl(m.body);
          const menuOpen = menuFor === m.id;

          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className="relative max-w-[72%]">
                {menuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute -top-9 right-0 z-10 flex items-center gap-1 rounded-full border bg-card px-1.5 py-1 shadow-md"
                  >
                    {!isImage && !isAudio && (
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs hover:bg-accent"
                        onClick={() => startEdit(m)}
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-destructive hover:bg-accent"
                      onClick={() => void deleteMessage(m)}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                )}

                <div
                  onTouchStart={() => pressStart(mine, m.id)}
                  onTouchEnd={pressEnd}
                  onTouchCancel={pressEnd}
                  onMouseDown={() => pressStart(mine, m.id)}
                  onMouseUp={pressEnd}
                  onMouseLeave={pressEnd}
                  className={`rounded-2xl px-3 py-1.5 text-sm leading-snug ${
                    mine ? "bg-primary text-primary-foreground" : "bg-muted"
                  } ${isImage ? "p-1.5" : ""} ${isDeleting ? "opacity-50" : ""}`}
                >
                  {isEditing ? (
                    <div className="space-y-2 py-1">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        disabled={savingEdit}
                        className="w-full resize-none rounded-md border bg-background p-2 text-sm text-foreground"
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
                          <X className="mr-1 h-4 w-4" /> Cancel
                        </Button>
                        <Button size="sm" disabled={savingEdit || !editText.trim()} onClick={() => void saveEdit(m)}>
                          {savingEdit ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : isImage ? (
                    <img src={m.body} alt="Attachment" className="max-h-56 w-full rounded-xl object-cover" />
                  ) : isAudio ? (
                    <VoiceNoteBubble src={m.body} mine={mine} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  )}

                  <p className={`mt-0.5 text-[10px] opacity-70 ${isImage ? "px-1" : ""}`}>
                    {m.from_staff ? "JK Academy" : "Student"} · {formatDateTime(m.created_at)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {showEmoji && !recording && (
        <div className="flex flex-wrap gap-1 border-t bg-muted/30 p-2">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              className="rounded-md px-1.5 py-1 text-lg hover:bg-accent"
              onClick={() => setText((t) => t + em)}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {recording ? (
        <div className="flex items-center gap-2 border-t p-2">
          <button
            type="button"
            aria-label="Cancel recording"
            onClick={cancelRecording}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-accent"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-2xl border bg-background px-3 py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
            <span className="text-sm font-medium">Recording… {fmtTimer(recordSeconds)}</span>
          </div>
          <button
            type="button"
            aria-label="Stop and send"
            onClick={() => void stopAndSendRecording()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5 border-t p-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAttach} />
          <button
            type="button"
            aria-label="Attach photo"
            disabled={uploadingAttachment}
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            {uploadingAttachment ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
          </button>

          <div className="flex min-h-9 flex-1 items-end gap-1 rounded-2xl border bg-background px-2 py-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              maxLength={2000}
              placeholder="Type your message…"
              className="max-h-24 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              aria-label="Emoji"
              onClick={() => setShowEmoji((s) => !s)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <Smile className="h-5 w-5" />
            </button>
          </div>

          {text.trim() ? (
            <button
              type="button"
              aria-label="Send"
              disabled={sending}
              onClick={() => void send()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          ) : (
            <button
              type="button"
              aria-label="Record voice message"
              disabled={uploadingVoice}
              onClick={() => void startRecording()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            >
              {uploadingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
  }
