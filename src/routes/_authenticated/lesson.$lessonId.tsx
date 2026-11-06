import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PdfViewer, downloadFile } from "@/components/PdfViewer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { replyLessonCommentAi, replyLessonReportAi } from "@/lib/ai-chat.functions";
import { cacheMedia, getCachedMedia } from "@/lib/offline-media";
import { addDownload, isDownloaded } from "@/lib/downloads";
import { fetchCourseLessonIds } from "@/lib/queries";
import {
  BarChart3, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Download,
  FileText, Flag, GraduationCap, HelpCircle, Loader2, Maximize, MessageCircle,
  Minimize, Pause, Play, Rewind, FastForward, Send, Settings, X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/lesson/$lessonId")({
  head: () => ({
    meta: [
      { title: "Lesson — JK Academy" },
      { name: "description", content: "Watch the lesson video, read notes and track your progress." },
      { property: "og:title", content: "Lesson — JK Academy" },
      { property: "og:description", content: "Watch the lesson video and track your progress." },
    ],
  }),
  component: LessonPage,
});

function embedUrl(url: string) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/))([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function getMediaPath(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const marker = "/object/sign/media/";
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return url.pathname
      .slice(index + marker.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const QUALITIES = [1080, 720, 480, 360, 240, 144];

function fmtSize(bytes: number) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(0)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

/* ---------------- Class discussion (comments + AI teacher reply) ---------------- */

function LessonDiscussion({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const askAi = useServerFn(replyLessonCommentAi);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [teacherTyping, setTeacherTyping] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const comments = useQuery({
    queryKey: ["lesson-comments", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_comments")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function post() {
    const body = text.trim();
    if (!body || !user || posting) return;
    setPosting(true);
    const { data, error } = await supabase
      .from("lesson_comments")
      .insert({
        lesson_id: lessonId,
        user_id: user.id,
        author_name: profile.data?.full_name || "Student",
        body,
      })
      .select("id")
      .single();
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    await qc.invalidateQueries({ queryKey: ["lesson-comments", lessonId] });
    setTeacherTyping(true);
    try {
      const r = await askAi({ data: { commentId: data.id } });
      if (!r.ok && "error" in r && r.error) toast.error(r.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Teacher reply nahi aaya");
    } finally {
      setTeacherTyping(false);
      await qc.invalidateQueries({ queryKey: ["lesson-comments", lessonId] });
    }
  }

  const all = comments.data ?? [];
  const topLevel = all.filter((c) => !c.parent_id);
  const repliesFor = (id: string) => all.filter((c) => c.parent_id === id);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Lesson comments"
        className="flex max-h-[72dvh] min-h-[52dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[26px] border border-black/5 bg-white shadow-[0_-12px_45px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pt-2.5">
          <span className="h-1.5 w-12 rounded-full bg-gray-300" />
        </div>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <h2 className="text-lg font-extrabold text-[#242424]">Comments</h2>
            <p className="text-xs text-gray-500">{all.length} comments · Class discussion</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close comments" className="rounded-full p-2 text-gray-600 transition hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-4 py-4">
          {comments.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-gold-deep" />}
          {!comments.isLoading && topLevel.length === 0 && (
            <div className="py-10 text-center">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm font-semibold text-gray-700">No comments yet</p>
              <p className="mt-1 text-xs text-gray-500">Be the first to ask or share with your class.</p>
            </div>
          )}
          {topLevel.map((c) => (
            <div key={c.id} className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5E8D1] text-sm font-extrabold text-[#96652B]">
                  {(c.author_name || "S").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-extrabold text-[#242424]">{c.author_name}</p>
                    <span className="text-[11px] text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#303030] [overflow-wrap:anywhere]">{c.body}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs font-semibold text-gray-500">
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> Reply</span>
                  </div>
                </div>
              </div>
              {repliesFor(c.id).map((r) => (
                <div key={r.id} className="ml-8 flex items-start gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-deep text-primary-foreground">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl bg-[#F6F6F6] px-3.5 py-3">
                    <p className="text-xs font-extrabold text-[#8B612F]">{r.author_name}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#303030] [overflow-wrap:anywhere]">{r.body}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {teacherTyping && (
            <p className="flex items-center gap-2 pl-12 text-xs font-medium text-gold-deep">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Teacher is replying…
            </p>
          )}
        </div>

        <form
          className="shrink-0 border-t border-gray-100 bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"
          onSubmit={(e) => { e.preventDefault(); void post(); }}
        >
          <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-[#FAFAFA] p-2 shadow-inner">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Add a comment…"
              className="max-h-28 min-h-12 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-[#242424] outline-none placeholder:text-gray-400"
            />
            <button
              type="submit"
              aria-label="Post comment"
              disabled={posting || !text.trim()}
              className="mb-1 flex h-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#A96C20] to-[#C18A3C] px-4 text-sm font-bold text-white shadow-md transition hover:brightness-105 disabled:opacity-45"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ---------------- Polls ---------------- */

function LessonPolls({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [voting, setVoting] = useState<string | null>(null);

  const polls = useQuery({
    queryKey: ["lesson-polls", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_polls")
        .select("id, question, created_at, lesson_poll_options(id, label, position), lesson_poll_votes(option_id, user_id)")
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function vote(pollId: string, optionId: string) {
    if (!user) return;
    setVoting(optionId);
    const { error } = await supabase.from("lesson_poll_votes").insert({ poll_id: pollId, option_id: optionId, user_id: user.id });
    setVoting(null);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "You already voted in this poll." : error.message);
      return;
    }
    toast.success("Vote recorded");
    await qc.invalidateQueries({ queryKey: ["lesson-polls", lessonId] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-bold">
            <BarChart3 className="h-5 w-5 text-gold-deep" /> Class polls
          </p>
          <button type="button" onClick={onClose} aria-label="Close polls" className="rounded-full p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        {polls.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-gold-deep" />}
        {polls.data?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No poll for this lesson yet.</p>
        )}
        {polls.data?.map((p) => {
          const options = [...(p.lesson_poll_options ?? [])].sort((a, b) => a.position - b.position);
          const votes = p.lesson_poll_votes ?? [];
          const myVote = user ? votes.find((v) => v.user_id === user.id) : undefined;
          return (
            <div key={p.id} className="rounded-xl border border-gold/30 bg-cream p-3">
              <p className="mb-2 text-sm font-semibold">{p.question}</p>
              <div className="space-y-1.5">
                {options.map((o) => {
                  const count = votes.filter((v) => v.option_id === o.id).length;
                  const pct = votes.length ? Math.round((count / votes.length) * 100) : 0;
                  const mine = myVote?.option_id === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={!!myVote || voting === o.id}
                      onClick={() => void vote(p.id, o.id)}
                      className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm ${
                        mine ? "border-gold-deep bg-gold/20 font-semibold" : "border-border bg-card"
                      }`}
                    >
                      {votes.length > 0 && (
                        <span className="absolute inset-y-0 left-0 bg-gold/15" style={{ width: `${pct}%` }} />
                      )}
                      <span className="relative flex items-center justify-between gap-2">
                        <span className="min-w-0 [overflow-wrap:anywhere]">{o.label}{mine ? " ✓" : ""}</span>
                        {votes.length > 0 && <span className="shrink-0 text-xs text-muted-foreground">{pct}%</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {myVote ? `You voted · ${votes.length} vote${votes.length === 1 ? "" : "s"}` : `${votes.length} vote${votes.length === 1 ? "" : "s"} so far`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Report ---------------- */

const REPORT_REASONS = [
  "Video is not playing",
  "Audio problem",
  "Wrong or outdated content",
  "PDF/notes problem",
  "Other",
];

function LessonReport({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const { user } = useAuth();
  const askReportAi = useServerFn(replyLessonReportAi);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!user) return;
    setSending(true);
    const { data, error } = await supabase.from("lesson_reports").insert({
      lesson_id: lessonId,
      user_id: user.id,
      reason,
      details: details.trim() || null,
    }).select("id").single();
    if (error) {
      setSending(false);
      toast.error(error.message);
      return;
    }
    toast.success("Report sent. JK Academy AI is preparing a reply…");
    onClose();
    try {
      const result = await askReportAi({ data: { reportId: data.id } });
      if (!result.ok && "error" in result && result.error) toast.error(result.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI reply could not be generated.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-lg space-y-3 rounded-t-2xl bg-card p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-bold">
            <Flag className="h-5 w-5 text-destructive" /> Report a problem
          </p>
          <button type="button" onClick={onClose} aria-label="Close report" className="rounded-full p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Tell us what went wrong in this lesson.</p>
        <div className="grid grid-cols-1 gap-1.5">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${reason === r ? "border-gold-deep bg-gold/15 font-semibold" : "border-border"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Optional details…"
          className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-gold-deep"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold to-gold-deep font-semibold text-primary-foreground disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send report
        </button>
      </div>
    </div>
  );
}

/* ---------------- Main page ---------------- */

function LessonPage() {
  const { lessonId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nativeH, setNativeH] = useState(0);
  const [quality, setQuality] = useState(0); // 0 = auto/source
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setFullscreen(active);
      if (!active) setSettingsOpen(false);
      if (!active) {
        try {
          (screen as any).orientation?.unlock?.();
        } catch {
          // Orientation unlock may not be supported.
        }
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = fullscreen ? "hidden" : "";
  }, [fullscreen]);

  // Offline copy: use the cached video when this lesson was downloaded.
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    async function load() {
      const blob = await getCachedMedia(lessonId);
      if (blob && !cancelled) {
        url = URL.createObjectURL(blob);
        setCachedUrl(url);
        setSavedOffline(true);
      }
    }
    void load();
    if (isDownloaded(lessonId)) setSavedOffline(true);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [lessonId]);

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => toast.error("Video could not be played."));
    } else {
      video.pause();
    }
  };

  const changeSpeed = (value: number) => {
    setSpeed(value);
    if (videoRef.current) videoRef.current.playbackRate = value;
  };

  const applyQuality = (h: number) => {
    setQuality(h);
    const video = videoRef.current;
    if (!video) return;
    if (h === 0) {
      video.style.height = "";
      video.style.width = "";
    } else {
      video.style.height = `${h}px`;
      video.style.width = "100%";
    }
    setSettingsOpen(false);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const player = playerRef.current;
      if (!player) return;
      await player.requestFullscreen();
      try {
        await (screen as any).orientation?.lock?.("landscape");
      } catch {
        // Device or browser may not support orientation lock.
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
      toast.error("Fullscreen is not supported by this device.");
    }
  };

  const lesson = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*, chapters(id, name, subjects(id, name, course_id, courses(id, title)))")
        .eq("id", lessonId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const courseId = lesson.data?.chapters?.subjects?.course_id ?? null;

  const siblings = useQuery({
    queryKey: ["lesson-order", courseId],
    enabled: !!courseId,
    queryFn: () => fetchCourseLessonIds(courseId!),
  });

  const myProgress = useQuery({
    queryKey: ["lesson-progress", lessonId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("*")
        .eq("user_id", user!.id)
        .eq("lesson_id", lessonId)
        .maybeSingle();
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (completed: boolean) => {
      if (!user || !courseId) return;
      const { error } = await supabase.from("lesson_progress").upsert(
        {
          user_id: user.id,
          lesson_id: lessonId,
          course_id: courseId,
          completed,
          last_viewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" }
      );
      if (error) throw error;
    },
    onSuccess: (_data, completed) => {
      if (completed) toast.success("Lesson marked as completed");
      queryClient.invalidateQueries({ queryKey: ["lesson-progress", lessonId] });
      queryClient.invalidateQueries({ queryKey: ["progress", courseId] });
      queryClient.invalidateQueries({ queryKey: ["all-progress"] });
      queryClient.invalidateQueries({ queryKey: ["completed-lessons", courseId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function downloadVideo() {
    const l = lesson.data;
    if (!l?.video_url) {
      toast.error("No video to download for this lesson.");
      return;
    }
    const mediaPath = getMediaPath(l.video_url);
    if (!mediaPath) {
      toast.error("Only uploaded lecture videos can be saved for offline viewing.");
      return;
    }
    if (savedOffline) {
      toast.info("Already saved — open Profile → My Downloads.");
      return;
    }
    setDownloading(true);
    const toastId = toast.loading("Saving video for offline…");
    try {
      const { data, error } = await supabase.storage.from("media").createSignedUrl(mediaPath, 60 * 60);
      if (error || !data?.signedUrl) throw new Error("Could not fetch the video.");
      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error("Download failed — try again");
      const blob = await res.blob();
      if (!blob.size) throw new Error("Download failed — empty file");
      await cacheMedia(lessonId, blob);
      addDownload({
        key: lessonId,
        lessonId,
        title: l.title,
        courseId,
        size: blob.size,
        at: new Date().toISOString(),
      });
      setSavedOffline(true);
      setCachedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      toast.success("Saved! Watch offline from Profile → My Downloads.", { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the video.", { id: toastId });
    } finally {
      setDownloading(false);
    }
  }

  if (lesson.isLoading) {
    return <StudentShell><LoadingState /></StudentShell>;
  }
  if (lesson.error) {
    return (
      <StudentShell>
        <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />
      </StudentShell>
    );
  }
  if (!lesson.data) {
    return <StudentShell><EmptyState title="Lesson not found" /></StudentShell>;
  }

  const l = lesson.data;
  const order = siblings.data ?? [];
  const idx = order.indexOf(lessonId);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  const embed = l.video_url ? embedUrl(l.video_url) : null;
  const completed = !!myProgress.data?.completed;
  const videoSrc = cachedUrl ?? l.video_url;
  const qualities = QUALITIES.filter((q) => !nativeH || q <= nativeH);

  const playerElement = l.video_url ? (
    <div
      ref={playerRef}
      className={`relative w-full overflow-hidden rounded-none bg-black shadow-lg ${
        fullscreen ? "flex h-full w-full items-center justify-center" : ""
      }`}
    >
      {embed ? (
        <div className="aspect-[16/10] w-full overflow-hidden bg-black">
          <iframe
            src={embed}
            title={l.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      ) : (
        <div className={`relative ${fullscreen ? "h-full w-full" : "aspect-video w-full"}`}>
          {videoSrc ? (
            <video
              ref={videoRef}
              key={videoSrc}
              src={videoSrc}
              playsInline
              preload="metadata"
              onClick={togglePlay}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onLoadedMetadata={(event) => {
                const el = event.currentTarget;
                setDuration(el.duration || 0);
                el.playbackRate = speed;
                setNativeH(el.videoHeight || 0);
                if (quality) applyQuality(quality);
              }}
              onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
              onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
              onEnded={() => setPlaying(false)}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
              Video unavailable
            </div>
          )}

          {/* Center play */}
          {!playing && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Play video"
              className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/55 shadow-xl backdrop-blur-sm"
            >
              <Play className="ml-1 h-8 w-8 fill-white text-white" />
            </button>
          )}

          {/* Skip buttons */}
          <div className="absolute inset-y-0 left-0 flex items-center pl-2">
            <button
              type="button"
              onClick={() => seek(-10)}
              aria-label="Back 10 seconds"
              className="flex flex-col items-center rounded-full bg-black/55 p-2.5 text-white backdrop-blur-sm"
            >
              <Rewind className="h-5 w-5" />
              <span className="text-[9px] font-semibold">10s</span>
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <button
              type="button"
              onClick={() => seek(10)}
              aria-label="Forward 10 seconds"
              className="flex flex-col items-center rounded-full bg-black/55 p-2.5 text-white backdrop-blur-sm"
            >
              <FastForward className="h-5 w-5" />
              <span className="text-[9px] font-semibold">10s</span>
            </button>
          </div>

          {/* Top-right: fullscreen + settings */}
          <div className="absolute right-2 top-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label="Toggle fullscreen"
              className="rounded-full bg-black/55 p-2 text-white backdrop-blur-sm"
            >
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen((s) => !s)}
              aria-label="Playback settings"
              className={`rounded-full p-2 text-white backdrop-blur-sm ${settingsOpen ? "bg-gold-deep" : "bg-black/55"}`}
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>

          {/* Settings panel */}
          {settingsOpen && (
            <div className="absolute right-2 top-12 z-30 w-60 rounded-xl border border-gold/40 bg-black/90 p-3 text-white shadow-2xl backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gold">Playback speed</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeSpeed(s)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      speed === s ? "bg-gold text-black" : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <div className="my-2.5 border-t border-white/15" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-gold">Quality</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyQuality(0)}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    quality === 0 ? "bg-gold text-black" : "bg-white/10 hover:bg-white/20"
                  }`}
                >
                  Auto
                </button>
                {qualities.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => applyQuality(q)}
                    className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                      quality === q ? "bg-gold text-black" : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    {q}p
                  </button>
                ))}
              </div>
              {nativeH > 0 && (
                <p className="mt-2 text-[10px] text-white/60">Source quality: {nativeH}p</p>
              )}
              <div className="my-2.5 border-t border-white/15" />
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  void downloadVideo();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-white/10"
              >
                <Download className="h-4 w-4 text-gold" />
                {savedOffline ? "Saved for offline ✓" : "Save for offline"}
              </button>
            </div>
          )}

          {/* Bottom bar */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2.5 pt-8">
            <input
              aria-label="Video progress"
              type="range"
              min={0}
              max={duration || 100}
              step={1}
              value={Math.min(current, duration || 100)}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (videoRef.current) videoRef.current.currentTime = value;
                setCurrent(value);
              }}
              className="h-1.5 w-full cursor-pointer accent-gold"
            />
            <div className="mt-1 flex items-center justify-between text-xs font-semibold text-white">
              <button
                type="button"
                onClick={togglePlay}
                className="flex items-center gap-1.5"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span>{formatTime(current)}</span>
              </button>
              <span className="text-white/85">{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <StudentShell>
      <div className="mx-auto max-w-5xl space-y-4 bg-white">
        {playerElement}

        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
          {courseId && <Link to="/courses/$courseId" params={{ courseId }} className="text-gold-deep hover:underline">{l.chapters?.subjects?.courses?.title ?? "Course"}</Link>}
          <span>/</span><span>{l.chapters?.subjects?.name}</span><span>/</span><span>{l.chapters?.name}</span>
        </div>

        {!l.video_url && (
          <div className="rounded-2xl border border-gold/30 bg-cream p-5 text-sm text-muted-foreground">
            No video available for this lesson.
          </div>
        )}

        {/* Title card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_6px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-gold to-gold-deep" />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-extrabold leading-snug tracking-tight sm:text-xl">{l.title}</h1>
              <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-gold-deep">
                {[l.chapters?.subjects?.courses?.title, l.chapters?.subjects?.name, l.chapters?.name]
                  .filter(Boolean)
                  .join("  •  ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => save.mutate(!completed)}
              disabled={save.isPending}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                completed
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-gold/40 bg-gold/15 text-gold-deep"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {completed ? "Completed" : "Mark complete"}
            </button>
          </div>
        </div>

        {/* Premium quick actions */}
        <div className="grid grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => setShowComments(true)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-[#E7D7BD] bg-white px-2 py-3.5 text-center shadow-[0_5px_16px_rgba(112,73,27,0.09)] transition active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#FFF8EA] to-[#EED8B4] text-[#98672E] shadow-inner"><MessageCircle className="h-5 w-5" /></span>
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#805A2D]">Comments</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPolls(true)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-[#E7D7BD] bg-white px-2 py-3.5 text-center shadow-[0_5px_16px_rgba(112,73,27,0.09)] transition active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#FFF8EA] to-[#EED8B4] text-[#98672E] shadow-inner"><BarChart3 className="h-5 w-5" /></span>
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#805A2D]">Polls</span>
          </button>
          <button
            type="button"
            onClick={() => void downloadVideo()}
            disabled={downloading}
            className="flex flex-col items-center gap-2 rounded-2xl border border-[#E7D7BD] bg-white px-2 py-3.5 text-center shadow-[0_5px_16px_rgba(112,73,27,0.09)] transition active:scale-[0.98] disabled:opacity-60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#FFF8EA] to-[#EED8B4] text-[#98672E] shadow-inner">{downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#805A2D]">{savedOffline ? "Saved" : "Saved"}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-[#E7D7BD] bg-white px-2 py-3.5 text-center shadow-[0_5px_16px_rgba(112,73,27,0.09)] transition active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#FFF8EA] to-[#EED8B4] text-[#98672E] shadow-inner"><Flag className="h-5 w-5" /></span>
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#805A2D]">Report</span>
          </button>
        </div>

        {/* Lesson material */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gold/20 px-4 py-3">
            <FileText className="h-4 w-4 text-gold-deep" />
            <p className="text-sm font-extrabold uppercase tracking-wide text-foreground">Lesson material</p>
          </div>
          <div className="divide-y divide-gold/20">
            {l.pdf_url ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowPdf((s) => !s)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-[10px] font-black text-destructive">
                    PDF
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">PDF class notes</span>
                    <span className="block text-xs text-muted-foreground">View and download notes</span>
                  </span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-gold-deep transition-transform ${showPdf ? "rotate-180" : ""}`} />
                </button>
                {showPdf && (
                  <div className="px-4 pb-4">
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => downloadFile(l.pdf_url!, l.title)}
                        className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1.5 text-xs font-bold text-gold-deep"
                      >
                        <Download className="h-3.5 w-3.5" /> Download PDF
                      </button>
                    </div>
                    <PdfViewer
                      url={l.pdf_url}
                      className="max-h-[55vh] overflow-y-auto rounded-lg border border-gold/30 bg-surface p-2"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">No PDF notes for this lesson yet.</p>
            )}
            <Link
              to="/doubts"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gold/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-gold-deep">
                <HelpCircle className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Ask your doubt</span>
                <span className="block text-xs text-muted-foreground">Get answers from the teacher</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-gold-deep" />
            </Link>
          </div>
        </section>

        {l.description && (
          <details className="rounded-2xl border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-bold">About this lesson</summary>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{l.description}</p>
          </details>
        )}

        {/* Previous / Next */}
        <div className="flex gap-3 pb-2">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && navigate({ to: "/lesson/$lessonId", params: { lessonId: prev } })}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-gold/40 bg-white text-sm font-extrabold uppercase tracking-wide text-gold-deep disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && navigate({ to: "/lesson/$lessonId", params: { lessonId: next } })}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold to-gold-deep text-sm font-extrabold uppercase tracking-wide text-primary-foreground shadow-md disabled:opacity-40"
          >
            Next lesson <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showComments && <LessonDiscussion lessonId={lessonId} onClose={() => setShowComments(false)} />}
      {showPolls && <LessonPolls lessonId={lessonId} onClose={() => setShowPolls(false)} />}
      {showReport && <LessonReport lessonId={lessonId} onClose={() => setShowReport(false)} />}
    </StudentShell>
  );
}
