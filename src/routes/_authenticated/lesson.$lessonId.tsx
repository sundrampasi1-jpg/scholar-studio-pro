
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PdfViewer, downloadFile } from "@/components/PdfViewer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FastForward,
  FileText,
  Maximize,
  MessageCircle,
  Rewind,
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

  const seekVideo = (seconds: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.max(0, video.currentTime + seconds);
  };

  const changeSpeed = (value: string) => {
    setSpeed(value);
    if (videoRef.current) videoRef.current.playbackRate = Number(value);
  };

  const openFullscreen = async () => {
    try {
      if (playerRef.current?.requestFullscreen) {
        await playerRef.current.requestFullscreen();
      } else {
        toast.error("Fullscreen is not supported by this browser.");
      }
    } catch {
      toast.error("Could not open fullscreen.");
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

  return (
    <StudentShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
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

        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              JK Academy • Video Lecture
            </p>
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-2xl">{l.title}</h1>
          </div>
          <span className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
            VIDEO LESSON
          </span>
        </div>

        {l.video_url ? (
          <section ref={playerRef} className="surface-card overflow-hidden rounded-xl border border-primary/20 bg-card shadow-sm">
            {embed ? (
              <div className="aspect-video w-full bg-black">
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
                <video
                  ref={videoRef}
                  src={l.video_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full bg-black object-contain"
                  onLoadedMetadata={() => {
                    if (videoRef.current) videoRef.current.playbackRate = Number(speed);
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-2 py-2 sm:px-3">
                  <div className="flex items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => seekVideo(-10)} aria-label="Back 10 seconds">
                      <Rewind className="mr-1 h-4 w-4" />10s
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => seekVideo(10)} aria-label="Forward 10 seconds">
                      10s<FastForward className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="lesson-speed" className="text-xs text-muted-foreground">Speed</label>
                    <select
                      id="lesson-speed"
                      value={speed}
                      onChange={(event) => changeSpeed(event.target.value)}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium"
                    >
                      <option value="0.5">0.5×</option>
                      <option value="0.75">0.75×</option>
                      <option value="1">1×</option>
                      <option value="1.25">1.25×</option>
                      <option value="1.5">1.5×</option>
                      <option value="2">2×</option>
                    </select>
                    <Button type="button" size="icon" variant="ghost" onClick={openFullscreen} aria-label="Fullscreen">
                      <Maximize className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : (
          <div className="surface-card mt-2 p-5 text-sm text-muted-foreground">
            No video for this lesson — read the description and notes below.
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold sm:text-base">{l.title}</h2>
            <p className="text-xs text-muted-foreground">
              {l.chapters?.subjects?.name ?? "Course lesson"} • Video lecture
            </p>
          </div>
          <Button
            onClick={() => save.mutate(!completed)}
            variant={completed ? "outline" : "default"}
            disabled={save.isPending}
            size="sm"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {completed ? "Completed — undo" : "Mark as completed"}
          </Button>
        </div>

        {l.pdf_url && (
          <div className="surface-card mt-3 rounded-lg border border-primary/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Lesson notes</p>
                  <p className="text-xs text-muted-foreground">PDF study material</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => downloadFile(l.pdf_url!, l.title)}>
                <Download className="mr-1.5 h-4 w-4" />Download PDF
              </Button>
            </div>
            <PdfViewer
              url={l.pdf_url}
              className="mt-3 max-h-[55vh] overflow-y-auto rounded-md border bg-surface p-2"
            />
          </div>
        )}

        {l.description && (
          <details className="surface-card mt-3 rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-semibold">About this lesson</summary>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{l.description}</p>
          </details>
        )}

        <div className="surface-card mt-3 rounded-lg border p-3">
          <p className="mb-2 text-sm font-semibold">Course lectures</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!prev}
                onClick={() => prev && navigate({ to: "/lesson/$lessonId", params: { lessonId: prev } })}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!next}
                onClick={() => next && navigate({ to: "/lesson/$lessonId", params: { lessonId: next } })}
              >
                Next<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Link
          to="/doubts"
          className="surface-card mt-3 flex items-center justify-between rounded-lg border border-primary/20 p-3 text-sm font-semibold transition-colors hover:bg-muted/50"
        >
          <span className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            Ask your doubt
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </StudentShell>
  );
}
