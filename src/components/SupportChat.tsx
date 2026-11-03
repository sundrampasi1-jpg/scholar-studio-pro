import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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

  function fmt(s: number) {
    if (!isFinite(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch {
        toast.error("Voice message play nahi ho saka.");
      }
    }
  }

  return (
    <div className="flex min-w-[170px] items-center gap-2 py-1">
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
        onClick={() => void toggle()}
        aria-label={playing ? "Pause" : "Play"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          mine ? "bg-white/20" : "bg-[#B8792E]/15"
        }`}
      >
        {playing ? <Pause size={17} /> : <Play size={17} />}
      </button>

      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-current/20">
        <div
          className="h-full rounded-full bg-current/70"
          style={{ width: duration ? `${(current / duration) * 100}%` : "0%" }}
        />
      </div>
      <span className="text-[11px] opacity-80">
        {fmt(playing || current ? current : duration)}
      </span>
    </div>
  );
}

export function SupportChat({
  studentId,
  senderId,
  asStaff = false,
  fullHeight = false,
  quickActions,
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

  const menuRef = useRef<HTMLDivElement>(null);
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

  // Realtime updates
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

    return () => {
      void supabase.removeChannel(channel);
    };
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

  // FIX: outside tap closes menu, but tapping Edit/Delete inside it does not.
  useEffect(() => {
    if (!menuFor) return;

    function handleOutsidePointer(e: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuFor(null);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [menuFor]);

  async function sendBody(body: string) {
    if (!body.trim() || sending) return;

    setSending(true);

    const { error } = await supabase.from("support_messages").insert({
      student_id: studentId,
      sender_id: senderId,
      body,
      from_staff: asStaff,
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
        toast.error("Message send ho gaya, notification nahi bheji gayi.");
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
        toast.error("Voice recording is not supported on this device.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      recordedChunks.current = [];

      const rec = new MediaRecorder(stream);

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };

      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      rec.start();
      recorderRef.current = rec;

      setRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast.error("Microphone permission nahi mili. Check app permissions.");
    }
  }

  function cancelRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);

    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }

    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordedChunks.current = [];

    setRecording(false);
    setRecordSeconds(0);
  }

  async function stopAndSendRecording() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;

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

    const blob = new Blob(recordedChunks.current, { type: rec.mimeType || "audio/webm" });
    recordedChunks.current = [];
    setRecordSeconds(0);

    setUploadingVoice(true);

    try {
      const url = await uploadMedia(
        blob,
        `chat-attachments/${senderId}`,
        `voice-${Date.now()}.webm`,
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
    if (message.sender_id !== senderId || message.from_staff !== asStaff) {
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

    if (message.sender_id !== senderId || message.from_staff !== asStaff) {
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
      .eq("from_staff", asStaff)
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
    toast.success("Message updated.");
    await qc.invalidateQueries({ queryKey: key });
  }

  async function deleteMessage(message: {
    id: string;
    sender_id: string;
    from_staff: boolean;
  }) {
    if (message.sender_id !== senderId || message.from_staff !== asStaff) {
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
      .eq("from_staff", asStaff)
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

    if (editingId === message.id) {
      setEditingId(null);
      setEditText("");
    }

    toast.success("Message deleted.");
    await qc.invalidateQueries({ queryKey: key });
  }

  function fmtTimer(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  }

  function pressStart(mine: boolean, id: string) {
    if (!mine) return;

    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);

    pressTimerRef.current = setTimeout(() => {
      setMenuFor(id);
    }, 500);
  }

  function pressEnd() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  return (
    <div
      className={
        fullHeight
          ? "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#EADCCB] bg-white shadow-sm"
          : "flex flex-col rounded-2xl border border-[#EADCCB] bg-white shadow-sm"
      }
    >
      {/* Messages: only this area scrolls */}
      <div
        className={
          fullHeight
            ? "min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#FFFAF3] p-3"
            : "h-80 space-y-3 overflow-y-auto p-3"
        }
      >
        {msgs.isLoading && (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#B8792E]" />
        )}

        {msgs.isError && (
          <div className="py-4 text-center text-sm text-destructive">
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

        {msgs.data?.length === 0 && !msgs.isLoading && (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#F7E9D5] text-[#A96720]">
              <MessageCircleIcon />
            </div>
            <p className="font-semibold text-[#493728]">Welcome to JK Academy!</p>
            <p className="mt-1 text-sm text-[#907D6C]">No messages yet. Say hello!</p>
          </div>
        )}

        {msgs.data?.map((m) => {
          const mine = m.sender_id === senderId && m.from_staff === asStaff;
          const isEditing = editingId === m.id;
          const isDeleting = deletingId === m.id;
          const isImage = isImageUrl(m.body);
          const isAudio = isAudioUrl(m.body);
          const menuOpen = menuFor === m.id;

          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className="relative max-w-[85%] sm:max-w-[78%]">
                {menuOpen && mine && (
                  <div
                    ref={menuRef}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute -top-11 right-1 z-30 flex items-center gap-1 rounded-xl border border-[#EADCCB] bg-white p-1.5 shadow-xl"
                  >
                    {!isImage && !isAudio && (
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#75502A] hover:bg-[#FFF3E2]"
                        onClick={() => startEdit(m)}
                      >
                        <Pencil size={14} /> Edit
                      </button>
                    )}

                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                      onClick={() => void deleteMessage(m)}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}

                <div
                  onPointerDown={() => pressStart(mine, m.id)}
                  onPointerUp={pressEnd}
                  onPointerCancel={pressEnd}
                  onPointerLeave={pressEnd}
                  onContextMenu={(e) => {
                    if (mine) {
                      e.preventDefault();
                      setMenuFor(m.id);
                    }
                  }}
                  className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                    mine
                      ? "rounded-br-sm bg-gradient-to-br from-[#DCA85E] to-[#AD651C] text-white"
                      : "rounded-bl-sm border border-[#F0E6D9] bg-white text-[#33271F]"
                  } ${isDeleting ? "opacity-50" : ""}`}
                >
                  {isEditing ? (
                    <div className="min-w-[200px] space-y-2 py-1">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        disabled={savingEdit}
                        className="w-full resize-none rounded-lg border border-[#EADCCB] bg-white p-2 text-sm text-[#24180F] outline-none focus:ring-2 focus:ring-[#C58B43]"
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

                  <p className={`mt-1 text-[10px] opacity-70 ${isImage ? "px-1" : ""}`}>
                    {m.from_staff ? "JK Academy" : "You"} · {formatDateTime(m.created_at)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* Emoji panel */}
      {showEmoji && !recording && (
        <div className="flex shrink-0 flex-wrap gap-2 border-t border-[#EADCCB] bg-white p-2">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              className="rounded-lg p-1.5 text-xl hover:bg-[#FFF3E2]"
              onClick={() => setText((t) => t + em)}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Quick action chips */}
      {quickActions && (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-[#F0E6D9] bg-white px-3 py-2">
          {quickActions}
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

          <div className="flex flex-1 items-center gap-2 rounded-full bg-[#FFF3E2] px-4 py-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-semibold text-[#704B28]">
              Recording… {fmtTimer(recordSeconds)}
            </span>
          </div>

          <button
            type="button"
            aria-label="Stop and send"
            onClick={() => void stopAndSendRecording()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#DCA85E] to-[#AD651C] text-white"
          >
            <Square size={17} />
          </button>
        </div>
      ) : (
        <div
          className="flex shrink-0 items-end gap-2 border-t border-[#EADCCB] bg-white px-3 py-3"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
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
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[#9A744B] hover:bg-[#FFF3E2] disabled:opacity-50"
          >
            {uploadingAttachment ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Paperclip size={20} />
            )}
          </button>

          <div className="flex min-h-11 min-w-0 flex-1 items-end gap-1 rounded-3xl border border-[#EADCCB] bg-[#FFFCF8] px-3 py-2 shadow-sm focus-within:border-[#C58B43]">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              maxLength={2000}
              placeholder="Type your message..."
              className="max-h-28 min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-sm text-[#33271F] outline-none placeholder:text-[#A79787]"
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9A744B] hover:bg-[#FFF3E2]"
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#DCA85E] to-[#AD651C] text-white shadow-md disabled:opacity-50"
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#DCA85E] to-[#AD651C] text-white shadow-md disabled:opacity-50"
            >
              {uploadingVoice ? (
                <Loader2 size={19} className="animate-spin" />
              ) : (
                <Mic size={20} />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MessageCircleIcon() {
  return <Send size={23} />;
                    }
