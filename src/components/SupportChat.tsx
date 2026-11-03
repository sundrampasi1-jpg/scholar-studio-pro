
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Send, Pencil, Trash2, Check, X,
  Paperclip, Smile, Mic, Square, Play, Pause
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
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex min-w-[150px] items-center gap-2 py-1">
      <audio
        ref={audioRef}
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
        onClick={toggle}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          mine ? "bg-[#D2E7FA]" : "bg-[#DCEEFF]"
        }`}
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-current/20">
        <div
          className="h-full rounded-full bg-current/60"
          style={{ width: duration ? `${(current / duration) * 100}%` : "0%" }}
        />
      </div>
      <span className="text-[10px] opacity-80">
        {fmt(playing || current ? current : duration)}
      </span>
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
        {
          event: "*",
          schema: "public",
          table: "support_messages",
          filter: `student_id=eq.${studentId}`,
        },
        () => void qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [studentId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs.data?.length]);

  useEffect(() => {
    return () => {
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []);

  // Close the menu only when clicking outside it and outside its message.
  useEffect(() => {
    if (!menuFor) return;

    function close(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-message-menu]") &&
        !target.closest("[data-message-bubble]")
      ) {
        setMenuFor(null);
      }
    }

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

      recordTimerRef.current = setInterval(
        () => setRecordSeconds((s) => s + 1),
        1000
      );
    } catch {
      toast.error("Could not access microphone. Check app permissions.");
    }
  }

  function cancelRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);

    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();

    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordedChunks.current = [];
    setRecording(false);
    setRecordSeconds(0);
  }

  async function stopAndSendRecording() {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;

    if (recordTimerRef.current) clearInterval(recordTimerRef.current);

    setRecording(false);

    const finished = new Promise<void>((resolve) => {
      rec.addEventListener("stop", () => resolve(), { once: true });
    });

    rec.stop();
    await finished;

    if (recordSeconds < 1 || recordedChunks.current.length === 0) {
      recordedChunks.current = [];
      setRecordSeconds(0);
      return;
    }

    const blob = new Blob(recordedChunks.current, { type: "audio/webm" });
    recordedChunks.current = [];
    setRecordSeconds(0);

    setUploadingVoice(true);

    try {
      const url = await uploadMedia(
        blob,
        `chat-attachments/${senderId}`,
        `voice-${Date.now()}.webm`
      );
      await sendBody(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice message could not be sent");
    } finally {
      setUploadingVoice(false);
    }
  }

  function startEdit(message: {
    id: string;
    body: string;
    sender_id: string;
    from_staff: boolean;
  }) {
    if (message.sender_id !== senderId || message.from_staff !== !!asStaff) {
      toast.error("Aap sirf apne messages edit kar sakte hain.");
      return;
    }

    if (isImageUrl(message.body) || isAudioUrl(message.body)) {
      toast.error("Photo aur voice message edit nahi ho sakte.");
      return;
    }

    setMenuFor(null);
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
      toast.error("Edit permission nahi mili. Supabase RLS check karein.");
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
      toast.error("Delete permission nahi mili. Supabase RLS check karein.");
      return;
    }

    if (editingId === message.id) {
      setEditingId(null);
      setEditText("");
    }

    await qc.invalidateQueries({ queryKey: key });
    toast.success("Message deleted");
  }

  function fmtTimer(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  }

  function pressStart(mine: boolean, id: string) {
    if (!mine) return;

    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);

    pressTimerRef.current = setTimeout(() => {
      setMenuFor(id);
    }, 450);
  }

  function pressEnd() {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  }

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-[#EADCCB] bg-[#FFFCF7] ${
        fullHeight ? "h-full flex-1" : ""
      }`}
    >
      {/* Message list */}
      <div
        className={`min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 ${
          fullHeight ? "" : "h-80"
        }`}
      >
        {msgs.isLoading && (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#B77A35]" />
        )}

        {msgs.isError && (
          <div className="text-center text-sm text-red-600">
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

        {/* Welcome message intentionally unchanged */}
        {msgs.data?.length === 0 && !msgs.isLoading && (
          <div className="flex min-h-48 flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#F8EBDD]">
              <Mic size={25} className="text-[#B77A35]" />
            </div>
            <p className="font-semibold text-[#57432E]">Welcome to JK Academy Support</p>
            <p className="mt-1 text-sm text-[#98836D]">
              Send a message. Our team will help you.
            </p>
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
              className={`flex min-w-0 flex-col ${
                mine ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`relative flex w-fit max-w-[82%] flex-col ${
                  mine ? "ml-auto" : "mr-auto"
                }`}
              >
                <div
                  data-message-bubble
                  onTouchStart={() => pressStart(mine, m.id)}
                  onTouchEnd={pressEnd}
                  onTouchCancel={pressEnd}
                  onContextMenu={(e) => {
                    if (mine) {
                      e.preventDefault();
                      setMenuFor(m.id);
                    }
                  }}
                  onMouseDown={() => pressStart(mine, m.id)}
                  onMouseUp={pressEnd}
                  onMouseLeave={pressEnd}
                  className={`w-fit max-w-full rounded-xl px-2.5 py-1 text-sm leading-relaxed shadow-sm text-[#202A35] ${
                    mine ? "bg-[#E3F1FF]" : "bg-[#F0F7FF]"
                  } ${isImage ? "p-1.5" : ""} ${
                    isDeleting ? "opacity-50" : ""
                  }`}
                >
                  {isEditing ? (
                    <div className="min-w-[200px] space-y-2 py-1">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        disabled={savingEdit}
                        className="w-full resize-none rounded-lg border bg-white p-2 text-sm text-[#302319]"
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
                          <X size={14} className="mr-1" /> Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={savingEdit || !editText.trim()}
                          onClick={() => void saveEdit(m)}
                        >
                          {savingEdit ? (
                            <Loader2 size={14} className="mr-1 animate-spin" />
                          ) : (
                            <Check size={14} className="mr-1" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : isImage ? (
                    <img
                      src={m.body}
                      alt="Chat attachment"
                      className="max-h-64 w-full rounded-xl object-cover"
                    />
                  ) : isAudio ? (
                    <VoiceNoteBubble src={m.body} mine={mine} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  )}
                </div>

                {/* Timestamp outside the message bubble */}
                <p className="mt-0.5 px-1 text-[10px] leading-tight text-[#968D83]">
                  {m.from_staff ? "JK Academy" : "You"} · {formatDateTime(m.created_at)}
                </p>
              </div>

              {menuOpen && mine && !isEditing && (
                <div
                  data-message-menu
                  onClick={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="relative z-30 mt-2 flex items-center gap-1 self-end rounded-xl border border-[#D8E8F6] bg-white p-1.5 shadow-lg"
                >
                  {!isImage && !isAudio && (
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#315B7D] hover:bg-[#EDF6FF]"
                    >
                      <Pencil size={15} /> Edit
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void deleteMessage(m)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={15} /> Delete
                  </button>

                  <button
                    type="button"
                    onClick={() => setMenuFor(null)}
                    aria-label="Close menu"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* Emoji panel */}
      {showEmoji && !recording && (
        <div className="flex shrink-0 flex-wrap gap-2 border-t border-[#EADCCB] bg-white p-3">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              className="rounded-lg p-1.5 text-xl hover:bg-[#FFF3E4]"
              onClick={() => setText((t) => t + em)}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Recording controls */}
      {recording ? (
        <div className="flex shrink-0 items-center gap-3 border-t border-[#EADCCB] bg-white p-3">
          <button
            type="button"
            aria-label="Cancel recording"
            onClick={cancelRecording}
            className="flex h-10 w-10 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
          >
            <Trash2 size={19} />
          </button>

          <div className="flex flex-1 items-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-semibold text-red-700">
              Recording... {fmtTimer(recordSeconds)}
            </span>
          </div>

          <button
            type="button"
            aria-label="Stop and send"
            onClick={() => void stopAndSendRecording()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#B87932] text-white"
          >
            <Square size={17} />
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-end gap-2 border-t border-[#EADCCB] bg-white p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAttach}
          />

          <button
            type="button"
            aria-label="Attach photo"
            disabled={uploadingAttachment}
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[#94785B] hover:bg-[#FFF3E4] disabled:opacity-50"
          >
            {uploadingAttachment ? (
              <Loader2 size={21} className="animate-spin" />
            ) : (
              <Paperclip size={21} />
            )}
          </button>

          <div className="flex min-h-12 min-w-0 flex-1 items-end rounded-full border border-[#EADCCB] bg-[#FFFCF7] px-3 py-2 shadow-sm">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              maxLength={2000}
              placeholder="Type your message..."
              className="max-h-24 min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-[#302319] outline-none placeholder:text-[#A79683]"
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#94785B] hover:bg-[#F5E9DA]"
            >
              <Smile size={20} />
            </button>
          </div>

          {text.trim() ? (
            <button
              type="button"
              aria-label="Send"
              disabled={sending}
              onClick={() => void send()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D8A45C] to-[#AD651C] text-white shadow-md disabled:opacity-50"
            >
              {sending ? (
                <Loader2 size={19} className="animate-spin" />
              ) : (
                <Send size={19} />
              )}
            </button>
          ) : (
            <button
              type="button"
              aria-label="Record voice message"
              disabled={uploadingVoice}
              onClick={() => void startRecording()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D8A45C] to-[#AD651C] text-white shadow-md disabled:opacity-50"
            >
              {uploadingVoice ? (
                <Loader2 size={19} className="animate-spin" />
              ) : (
                <Mic size={21} />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
