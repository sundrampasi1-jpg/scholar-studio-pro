 import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  fetchCourseProgress,
  fetchMyEnrollments,
  formatDateTime,
  liveStatus,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Personalized Dashboard — JK Academy" },
      { name: "description", content: "Your batches, live classes, notes, tests and study progress." },
      { property: "og:title", content: "Personalized Dashboard — JK Academy" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const uid = user?.id;

  const enrollments = useQuery({
    queryKey: ["enrollments", uid],
    enabled: !!uid,
    queryFn: () => fetchMyEnrollments(uid!),
  });

  const progress = useQuery({
    queryKey: ["all-progress", uid, enrollments.data?.map((e) => e.course_id).join(",")],
    enabled: !!uid && !!enrollments.data,
    queryFn: async () =>
      Promise.all((enrollments.data ?? []).map((e) => fetchCourseProgress(uid!, e.course_id))),
  });

  const live = useQuery({
    queryKey: ["upcoming-live", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_classes")
        .select("*")
        .gte("scheduled_at", new Date(Date.now() - 3 * 3600_000).toISOString())
        .order("scheduled_at")
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const attempts = useQuery({
    queryKey: ["recent-attempts", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_attempts")
        .select("id, score, total, submitted_at, tests(title)")
        .eq("user_id", uid!)
        .order("submitted_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const totalLessons = (progress.data ?? []).reduce((sum, item) => sum + item.total, 0);
  const doneLessons = (progress.data ?? []).reduce((sum, item) => sum + item.completed, 0);
  const overallProgress = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;
  const nextLive = live.data?.[0];

  const stats = [
    { label: "My batches", value: enrollments.data?.length ?? 0, emoji: "📚", grad: "from-amber-400 to-orange-500" },
    { label: "Lessons completed", value: `${doneLessons}/${totalLessons}`, emoji: "✅", grad: "from-emerald-400 to-teal-500" },
    { label: "Tests taken", value: attempts.data?.length ?? 0, emoji: "📝", grad: "from-sky-400 to-blue-500" },
    { label: "Upcoming live classes", value: live.data?.length ?? 0, emoji: "🔴", grad: "from-rose-400 to-pink-500" },
  ];

  return (
    <StudentShell>
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.5_0.14_55)] p-6 text-primary-foreground shadow-lg">
        <p className="text-xs font-semibold tracking-wide opacity-80">JK ACADEMY • STUDENT OVERVIEW</p>
        <h2 className="mt-1 text-2xl font-bold">Your study dashboard ✨</h2>
        <p className="mt-1 text-sm opacity-90">See your batches, next live class and study progress here.</p>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className={`rounded-2xl bg-gradient-to-br ${stat.grad} p-4 text-white shadow-md transition-transform active:scale-95`}>
              <span className="text-2xl">{stat.emoji}</span>
              <p className="mt-2 text-xl font-bold">{stat.value}</p>
              <p className="text-xs font-medium opacity-90">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="surface-card overflow-hidden p-5 shadow-md">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">⏰</span>
            <h2 className="font-semibold">Next live class</h2>
          </div>
          {live.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading live class info...</p>
          ) : live.error ? (
            <p className="mt-3 text-sm text-muted-foreground">Live class info isn't available right now.</p>
          ) : nextLive ? (
            <>
              <p className="mt-3 font-medium">{ne
