import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Send, Pencil, Trash2, Check, X,
  Paperclip, Smile, Mic, Square, Play, Pause,
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
  quickActions?: ReactNode;
};

const QUICK_EMOJIS = ["😀", "😂", "🙏", "👍", "❤️", "🎉", "😊", "🤔", "👏", "🔥"];

function isImageUrl(t: string) {
  return /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(t.trim());
}
function isAudioUrl(t: string) {
  return /^https?:\/\/\S+\.(webm|ogg|mp3|m4a|wav)(\?\S*)?$/i.test(t.trim());
}

function VoiceNoteBubble({ src, mine }: { src: string; mine: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex min-w-[150px] items-center gap-2 py-1">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
      />
      <button
        type="button"
        onClick={() => {
          if (!ref.current) return;
          if (playing) ref.current.pause();
          else void ref.current.play();
        }}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${mine ? "bg-white/20" : "bg-[#B8792E]/15"}`}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-current/20">
        <div className="h-full rounded-full bg-current/60" style={{ width: duration ? `${current / duration * 100}%` : "0%" }} />
      </div>
      <span className="text-[10px]">{fmt(playing || current ? current : duration)}</span>
    </div>
  );
}

export function SupportChat({
  studentId,
  senderId,
  asStaff,
  fullHeight,
  quickActions,
}: SupportChatProps) {
  const qc = useQueryClient();
  const key = ["support-chat", studentId];

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "support_messages",
        filter: `student_id=eq.${studentId}`,
      }, () => void qc.invalidateQueries({ queryKey: key }))
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [studentId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs.data?.length]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  }, []);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
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
      if (notificationError) toast.error("Message sent, notification failed.");
    }

    await qc.invalidateQueries({ queryKey: key });
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
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
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        toast.error("Voice recording is not supported on this device/browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => stream.getTracks().forEach((t) => t.stop());

      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone permission nahi mili. App settings check karein.");
    }
  }

  function cancelRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    chunksRef.current = [];
    setRecording(false);
    setRecordSeconds(0);
  }

  async function stopAndSendRecording() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;

    if (timerRef.current) clearInterval(timerRef.current);

    const finished = new Promise<void>((resolve) => {
      rec.addEventListener("stop", () => resolve(), { once: true });
    });

    rec.stop();
    setRecording(false);
    await finished;

    if (recordSeconds < 1) {
      chunksRef.current = [];
      setRecordSeconds(0);
      return;
    }

    const mime = rec.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    chunksRef.current = [];
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

  function startEdit(m: { id: string; body: string; sender_id: string; from_staff: boolean }) {
    if (m.sender_id !== senderId || m.from_staff !== !!asStaff) {
      toast.error("Aap sirf apne messages edit kar sakte hain.");
      return;
    }
    if (isImageUrl(m.body) || isAudioUrl(m.body)) {
      toast.error("Photo/voice message edit nahi ho sakta. Delete kar sakte hain.");
      return;
    }
    setMenuFor(null);
    setEditingId(m.id);
    setEditText(m.body);
  }

  async function saveEdit(m: { id: string; sender_id: string; from_staff: boolean }) {
    const body = editText.trim();
    if (!body) {
      toast.error("Message khaali nahi ho sakta.");
      return;
    }
    if (m.sender_id !== senderId || m.from_staff !== !!asStaff) {
      toast.error("Aap sirf apne messages edit kar sakte hain.");
      return;
    }

    setSavingEdit(true);
    const { data, error } = await supabase
      .from("support_messages")
      .update({ body })
      .eq("id", m.id)
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
      toast.error("Edit permission nahi hai. Supabase RLS policies check karein.");
      return;
    }

    setEditingId(null);
    setEditText("");
    await qc.invalidateQueries({ queryKey: key });
    toast.success("Message updated");
  }

  async function deleteMessage(m: { id: string; sender_id: string; from_staff: boolean }) {
    if (m.sender_id !== senderId || m.from_staff !== !!asStaff) {
      toast.error("Aap sirf apne messages delete kar sakte hain.");
      return;
    }

    setMenuFor(null);
    if (!window.confirm("Kya aap ye message delete karna chahte hain?")) return;

    setDeletingId(m.id);
    const { data, error } = await supabase
      .from("support_messages")
      .delete()
      .eq("id", m.id)
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
      toast.error("Delete permission nahi hai. Supabase RLS policies check karein.");
      return;
    }

    if (editingId === m.id) {
      setEditingId(null);
      setEditText("");
    }
    await qc.invalidateQueries({ queryKey: key });
    toast.success("Message deleted");
  }

  function pressStart(mine: boolean, id: string) {
    if (!mine) return;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => setMenuFor(id), 550);
  }

  function pressEnd() {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  }

  const timerText = `${Math.floor(recordSeconds / 60)}:${(recordSeconds % 60).toString().padStart(2, "0")}`;

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden border border-[#EADCCB] bg-[#FFFCF7] shadow-sm ${fullHeight ? "h-full rounded-[24px]" : "rounded-xl"}`}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
        {msgs.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#B8792E]" />}

        {msgs.isError && (
          <div className="py-5 text-center text-sm text-red-600">
            Messages load nahi hue.
            <Button size="sm" variant="outline" className="ml-2" onClick={() => void msgs.refetch()}>Retry</Button>
          </div>
        )}

        {msgs.data?.length === 0 && (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-center text-[#927D69]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F8EBDD]">
              <Mic size={25} className="text-[#B8792E]" />
            </div>
            <p className="font-semibold text-[#59432E]">Welcome to JK Academy Support</p>
            <p className="text-sm">Send us a message. We're here to help.</p>
          </div>
        )}

        {msgs.data?.map((m) => {
          const mine = m.sender_id === senderId && m.from_staff === !!asStaff;
          const isEditing = editingId === m.id;
          const isDeleting = deletingId === m.id;
          const isImage = isImageUrl(m.body);
          const isAudio = isAudioUrl(m.body);
          const menuOpen = menuFor === m.id;

          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative max-w-[82%]">
                <div
                  onTouchStart={() => pressStart(mine, m.id)}
                  onTouchEnd={pressEnd}
                  onTouchCancel={pressEnd}
                  onContextMenu={(e) => {
                    if (!mine) return;
                    e.preventDefault();
                    setMenuFor(m.id);
                  }}
                  onMouseDown={() => pressStart(mine, m.id)}
                  onMouseUp={pressEnd}
                  onMouseLeave={pressEnd}
                  className={`rounded-[20px] px-4 py-2.5 text-sm leading-relaxed shadow-sm select-none ${
                    mine
                      ? "rounded-br-md bg-gradient-to-br from-[#D8A45C] to-[#B8752C] text-white"
                      : "rounded-bl-md border border-[#EEE1D2] bg-white text-[#302319]"
                  } ${isImage ? "p-1.5" : ""} ${isDeleting ? "opacity-50" : ""}`}
                >
                  {isEditing ? (
                    <div className="min-w-[210px] space-y-2 py-1">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        disabled={savingEdit}
                        className="w-full resize-none rounded-xl border bg-white p-2 text-sm text-[#302319] outline-none focus:ring-2 focus:ring-[#D8A45C]"
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" disabled={savingEdit} onClick={() => { setEditingId(null); setEditText(""); }}>
                          <X size={14} className="mr-1" /> Cancel
                        </Button>
                        <Button size="sm" disabled={savingEdit || !editText.trim()} onClick={() => void saveEdit(m)}>
                          {savingEdit ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Check size={14} className="mr-1" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : isImage ? (
                    <img src={m.body} alt="Attachment" className="max-h-60 w-full rounded-xl object-cover" />
                  ) : isAudio ? (
                    <VoiceNoteBubble src={m.body} mine={mine} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  )}

                  <p className={`mt-1 text-[10px] opacity-70 ${isImage ? "px-1" : ""}`}>
                    {m.from_staff ? "JK Academy" : "You"} · {formatDateTime(m.created_at)}
                  </p>
                </div>

                {/* Message actions appear directly BELOW the selected message */}
                {menuOpen && mine && !isEditing && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-full z-50 mt-2 flex items-center gap-1 rounded-xl border border-[#EADCCB] bg-white p-1.5 shadow-xl ${mine ? "right-0" : "left-0"}`}
                  >
                    {!isImage && !isAudio && (
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#75502A] hover:bg-[#FFF3E2]"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteMessage(m)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {showEmoji && !recording && (
        <div className="flex shrink-0 flex-wrap gap-2 border-t border-[#EADCCB] bg-white p-3">
          {QUICK_EMOJIS.map((em) => (
            <button key={em} type="button" className="rounded-lg p-1 text-xl hover:bg-[#FFF3E2]" onClick={() => setText((t) => t + em)}>
              {em}
            </button>
          ))}
        </div>
      )}

      <div className="shrink-0 border-t border-[#EADCCB] bg-white p-3">
        {recording ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={cancelRecording} aria-label="Cancel recording" className="flex h-11 w-11 items-center justify-center rounded-full text-red-600 hover:bg-red-50">
              <Trash2 size={21} />
            </button>
            <div className="flex flex-1 items-center gap-2 rounded-full bg-[#FFF3E2] px-4 py-3">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm font-semibold text-[#75502A]">Recording… {timerText}</span>
            </div>
            <button type="button" onClick={() => void stopAndSendRecording()} aria-label="Stop and send" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#B8792E] text-white">
              <Square size={17} />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAttach} />
            <button
              type="button"
              aria-label="Attach photo"
              disabled={uploadingAttachment}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-11 w-10 shrink-0 items-center justify-center text-[#A47A4D] disabled:opacity-50"
            >
              {uploadingAttachment ? <Loader2 size={21} className="animate-spin" /> : <Paperclip size={23} />}
            </button>

            <div className="flex min-h-12 min-w-0 flex-1 items-end rounded-full border border-[#EADCCB] bg-[#FFFCF7] px-3 py-2 shadow-sm focus-within:border-[#C18A47]">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={1}
                maxLength={2000}
                placeholder="Type your message..."
                className="max-h-24 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[#302319] outline-none placeholder:text-[#A79786]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button type="button" aria-label="Emoji" onClick={() => setShowEmoji((s) => !s)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#A47A4D] hover:bg-[#F8EBDD]">
                <Smile size={21} />
              </button>
            </div>

            {text.trim() ? (
              <button type="button" aria-label="Send" disabled={sending} onClick={() => void send()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D8A45C] to-[#AD651C] text-white shadow-md disabled:opacity-50">
                {sending ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
              </button>
            ) : (
              <button type="button" aria-label="Record voice message" disabled={uploadingVoice} onClick={() => void startRecording()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D8A45C] to-[#AD651C] text-white shadow-md disabled:opacity-50">
                {uploadingVoice ? <Loader2 size={19} className="animate-spin" /> : <Mic size={21} />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick links are outside the message area, below the composer */}
      {quickActions && (
        <div className="relative z-20 flex shrink-0 items-center gap-2 overflow-x-auto border-t border-[#EADCCB] bg-[#FFFCF7] px-3 py-3">
          {quickActions}
        </div>
      )}
    </div>
  );
}
