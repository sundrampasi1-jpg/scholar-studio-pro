import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
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
    onSuccess: (_d, completed) => {
      if (completed) toast.success("Lesson marked as completed");
      queryClient.invalidateQueries({ queryKey: ["lesson-progress", lessonId] });
      queryClient.invalidateQueries({ queryKey: ["progress", courseId] });
      queryClient.invalidateQueries({ queryKey: ["all-progress"] });
      queryClient.invalidateQueries({ queryKey: ["completed-lessons", courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (lesson.isLoading) {
    return (
      <StudentShell>
        <LoadingState />
      </StudentShell>
    );
  }
  if (lesson.error) {
    return (
      <StudentShell>
        <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />
      </StudentShell>
    );
  }
  if (!lesson.data) {
    return (
      <StudentShell>
        <EmptyState title="Lesson not found" />
      </StudentShell>
    );
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
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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

      <h1 className="text-2xl font-semibold">{l.title}</h1>

      {l.video_url ? (
        <div className="surface-card mt-4 overflow-hidden">
          {embed ? (
            <div className="aspect-video w-full">
              <iframe
                src={embed}
                title={l.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          ) : (
            <video src={l.video_url} controls className="aspect-video w-full bg-black" />
          )}
        </div>
      ) : (
        <div className="surface-card mt-4 p-6 text-sm text-muted-foreground">
          No video for this lesson — read the description and notes below.
        </div>
      )}

      {l.description && (
        <div className="surface-card mt-4 p-4">
          <h2 className="mb-2 font-semibold">About this lesson</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{l.description}</p>
        </div>
      )}

      {l.pdf_url && (
        <div className="surface-card mt-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-medium">
              <FileText className="h-4 w-4 text-primary" /> Lesson notes
            </p>
            <Button asChild size="sm" variant="outline">
              <a href={l.pdf_url} target="_blank" rel="noreferrer">
                <Download className="mr-1.5 h-4 w-4" /> Open PDF
              </a>
            </Button>
          </div>
          <iframe src={l.pdf_url} title="Lesson notes" className="mt-3 h-[60vh] w-full rounded-md border" />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!prev}
            onClick={() => prev && navigate({ to: "/lesson/$lessonId", params: { lessonId: prev } })}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <Button
            variant="outline"
            disabled={!next}
            onClick={() => next && navigate({ to: "/lesson/$lessonId", params: { lessonId: next } })}
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={() => save.mutate(!completed)}
          variant={completed ? "outline" : "default"}
          disabled={save.isPending}
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          {completed ? "Completed — undo" : "Mark as completed"}
        </Button>
      </div>
    </StudentShell>
  );
}
