
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PdfViewer, downloadFile } from "@/components/PdfViewer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Download, FileText,
  Maximize, Minimize, MessageCircle, Pause, Play, Rewind,
  FastForward, Settings,
} from "lucide-react";
import { toast } from "sonner";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { fetchCourseLessonIds } from "@/lib/queries";

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

function LessonPage() {
  const { lessonId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const [speed, setSpeed] = useState("1");
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const updateFullscreen = () => {
      setFullscreen(document.fullscreenElement === playerRef.current);
    };
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

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

  const changeSpeed = (value: string) => {
    setSpeed(value);
    if (videoRef.current) videoRef.current.playbackRate = Number(value);
  };

  const toggleFullscreen = async () => {
    try {
      if (!playerRef.current) return;
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (playerRef.current.requestFullscreen) {
        await playerRef.current.requestFullscreen();
      } else {
        toast.error("Fullscreen is not supported by this browser.");
      }
    } catch {
      toast.error("Fullscreen could not be opened. Try your browser's fullscreen control.");
    }
  };

  const formatTime = (value: number) => {
    if (!Number.isFinite(value)) return "0:00";
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
        { onConflict: "user_id,lesson_id" },
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

  if (lesson.isLoading) {
    return <StudentShell><LoadingState /></StudentShell>;
  }

  if (lesson.error) {
    return <StudentShell><ErrorState error={lesson.error} onRetry={() => lesson.refetch()} /></StudentShell>;
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

  return (
    <StudentShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {courseId && (
            <Link to="/courses/$courseId" params={{ courseId }} className="hover:underline">
              {l.chapters?.subjects?.courses?.title ?? "Course"}
            </Link>
          )}
          <span>/</span>
          <span>{l.chapters?.subjects?.name}</span>
          <span>/</span>
          <span>{l.chapters?.name}</span>
        </div>

        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            JK ACADEMY • VIDEO LECTURE
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{l.title}</h1>
        </div>

        {l.video_url ? (
          <section
            ref={playerRef}
            className={`surface-card overflow-visible rounded-2xl border border-primary/20 bg-card shadow-lg ${fullscreen ? "flex h-screen flex-col justify-center rounded-none bg-black p-2" : ""}`}
          >
            {embed ? (
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                <iframe
                  src={embed}
                  title={l.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            ) : (
              <>
                <div className="group relative aspect-video w-full overflow-hidden rounded-t-xl bg-black">
                  <video
                    ref={videoRef}
                    src={l.video_url}
                    playsInline
                    preload="metadata"
                    onClick={togglePlay}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onLoadedMetadata={(event) => {
                      setDuration(event.currentTarget.duration || 0);
                      event.currentTarget.playbackRate = Number(speed);
                    }}
                    onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
                    onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
                    onEnded={() => setPlaying(false)}
                    className="h-full w-full cursor-pointer object-contain"
                  />

                  {!playing && (
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label="Play video"
                      className="absolute inset-0 flex items-center justify-center bg-black/10"
                    >
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-xl">
                        <Play className="ml-1 h-8 w-8 fill-current" />
                      </span>
                    </button>
                  )}

                  <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-3 sm:px-8">
                    <button
                      type="button"
                      onClick={() => seek(-10)}
                      aria-label="Back 10 seconds"
                      className="flex flex-col items-center rounded-full bg-black/65 p-3 text-white shadow-lg backdrop-blur-sm"
                    >
                      <Rewind className="h-6 w-6" />
                      <span className="text-[10px]">10s</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => seek(10)}
                      aria-label="Forward 10 seconds"
                      className="flex flex-col items-center rounded-full bg-black/65 p-3 text-white shadow-lg backdrop-blur-sm"
                    >
                      <FastForward className="h-6 w-6" />
                      <span className="text-[10px]">10s</span>
                    </button>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-8">
                    <div className="mb-2 flex items-center justify-between text-xs font-medium text-white">
                      <span>{formatTime(current)} / {formatTime(duration)}</span>
                      <span>{speed}×</span>
                    </div>
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
                      className="h-1.5 w-full cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-b-xl border-t border-border bg-card px-3 py-3">
                  <Button type="button" size="sm" variant="ghost" onClick={togglePlay}>
                    {playing ? <Pause className="mr-1 h-5 w-5" /> : <Play className="mr-1 h-5 w-5" />}
                    {playing ? "Pause" : "Play"}
                  </Button>

                  <div className="flex items-center gap-2">
                    <details className="relative">
                      <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted">
                        <Settings className="h-4 w-4" />
                        Settings
                      </summary>
                      <div className="absolute bottom-12 right-0 z-50 w-60 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-2xl">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Playback speed
                        </p>
                        <select
                          value={speed}
                          onChange={(event) => changeSpeed(event.target.value)}
                          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        >
                          <option value="0.5">0.5×</option>
                          <option value="0.75">0.75×</option>
                          <option value="1">1× Normal</option>
                          <option value="1.25">1.25×</option>
                          <option value="1.5">1.5×</option>
                          <option value="2">2×</option>
                        </select>

                        <div className="my-3 border-t border-border" />
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quality</p>
                        <p className="mt-1 text-sm">Original video quality</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Quality depends on the uploaded video source.
                        </p>

                        <div className="my-3 border-t border-border" />
                        <button
                          type="button"
                          onClick={() => {
                            if (l.video_url) downloadFile(l.video_url, l.title);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
                        >
                          <Download className="h-4 w-4" />
                          Download video
                        </button>
                      </div>
                    </details>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={toggleFullscreen}
                      aria-label="Toggle fullscreen"
                    >
                      {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : (
          <div className="surface-card rounded-xl p-5 text-sm text-muted-foreground">
            No video available for this lesson.
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-bold">{l.title}</h2>
            <p className="text-xs text-muted-foreground">
              {l.chapters?.subjects?.name ?? "Course"} • Video lecture
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => save.mutate(!completed)}
            variant={completed ? "outline" : "default"}
            disabled={save.isPending}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {completed ? "Completed — undo" : "Mark as completed"}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <a
            href="#lesson-pdf"
            className="surface-card flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold hover:bg-muted/50"
          >
            <FileText className="h-5 w-5 text-primary" />
            PDF Notes
          </a>
          <Link
            to="/doubts"
            className="surface-card flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold hover:bg-muted/50"
          >
            <MessageCircle className="h-5 w-5 text-primary" />
            Ask Doubt
          </Link>
        </div>

        {l.pdf_url && (
          <div id="lesson-pdf" className="surface-card mt-3 scroll-mt-20 rounded-xl border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold">
                <FileText className="h-4 w-4 text-primary" />
                Lesson Notes PDF
              </p>
              <Button size="sm" variant="outline" onClick={() => downloadFile(l.pdf_url!, l.title)}>
                <Download className="mr-1 h-4 w-4" />
                Download
              </Button>
            </div>
            <PdfViewer
              url={l.pdf_url}
              className="max-h-[55vh] overflow-y-auto rounded-lg border bg-surface p-2"
            />
          </div>
        )}

        {l.description && (
          <details className="surface-card mt-3 rounded-xl border p-3">
            <summary className="cursor-pointer font-semibold">About this lesson</summary>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{l.description}</p>
          </details>
        )}

        <div className="surface-card mt-3 rounded-xl border p-3">
          <p className="mb-3 font-semibold">Course lectures</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!prev}
              onClick={() => prev && navigate({ to: "/lesson/$lessonId", params: { lessonId: prev } })}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!next}
              onClick={() => next && navigate({ to: "/lesson/$lessonId", params: { lessonId: next } })}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </StudentShell>
  );
}
