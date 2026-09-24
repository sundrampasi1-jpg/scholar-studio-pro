import { supabase } from "@/integrations/supabase/client";

export type CourseProgress = {
  courseId: string;
  total: number;
  completed: number;
  percent: number;
  lastLessonId: string | null;
};

/** Lessons of a course, ordered for sequential navigation. */
export async function fetchCourseLessonIds(courseId: string) {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, position, chapters(id, name, position, lessons(id, title, position, is_published))")
    .eq("course_id", courseId)
    .order("position");
  if (error) throw error;
  const ordered: string[] = [];
  for (const s of data ?? []) {
    const chapters = [...(s.chapters ?? [])].sort((a, b) => a.position - b.position);
    for (const ch of chapters) {
      const lessons = [...(ch.lessons ?? [])]
        .filter((l) => l.is_published)
        .sort((a, b) => a.position - b.position);
      for (const l of lessons) ordered.push(l.id);
    }
  }
  return ordered;
}

export async function fetchCourseProgress(userId: string, courseId: string): Promise<CourseProgress> {
  const lessonIds = await fetchCourseLessonIds(courseId);
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed, last_viewed_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("last_viewed_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const completed = rows.filter((r) => r.completed && lessonIds.includes(r.lesson_id)).length;
  return {
    courseId,
    total: lessonIds.length,
    completed,
    percent: lessonIds.length ? Math.round((completed / lessonIds.length) * 100) : 0,
    lastLessonId: rows[0]?.lesson_id ?? lessonIds[0] ?? null,
  };
}

export async function fetchMyEnrollments(userId: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, status, created_at, course_id, courses(id, title, description, thumbnail_url, price, is_free)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function liveStatus(scheduledAt: string, durationMinutes: number) {
  const start = new Date(scheduledAt).getTime();
  const end = start + durationMinutes * 60_000;
  const now = Date.now();
  if (now < start) return "upcoming" as const;
  if (now <= end) return "live" as const;
  return "completed" as const;
}
