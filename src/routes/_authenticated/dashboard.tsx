import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, FileQuestion, Radio } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { DailyChallenge } from "@/components/DailyChallenge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchCourseProgress, fetchMyEnrollments, formatDateTime, liveStatus } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My dashboard — JK Academy" },
      { name: "description", content: "Your courses, progress, live classes and tests." },
      { property: "og:title", content: "My dashboard — JK Academy" },
      { property: "og:description", content: "Your courses, progress, live classes and tests." },
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

  const totalLessons = (progress.data ?? []).reduce((a, p) => a + p.total, 0);
  const doneLessons = (progress.data ?? []).reduce((a, p) => a + p.completed, 0);

  const stats = [
    { label: "Enrolled courses", value: enrollments.data?.length ?? 0, icon: BookOpen },
    { label: "Lessons completed", value: `${doneLessons}/${totalLessons}`, icon: CheckCircle2 },
    { label: "Tests attempted", value: attempts.data?.length ?? 0, icon: FileQuestion },
    { label: "Live sessions", value: live.data?.length ?? 0, icon: Radio },
  ];

  return (
    <StudentShell title="My dashboard" subtitle="Continue where you left off">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="surface-card p-4">
            <s.icon className="mb-2 h-5 w-5 text-primary" />
            <p className="text-xl font-semibold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {uid && (
        <div className="mt-6">
          <DailyChallenge userId={uid} />
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Continue learning</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/courses">All courses</Link>
          </Button>
        </div>
        {enrollments.isLoading ? (
          <LoadingState />
        ) : enrollments.error ? (
          <ErrorState error={enrollments.error} onRetry={() => enrollments.refetch()} />
        ) : (enrollments.data ?? []).length === 0 ? (
          <EmptyState
            title="You're not enrolled in any course yet"
            description="Browse the catalogue and enrol to start learning."
            action={
              <Button asChild className="mt-3">
                <Link to="/courses">Browse courses</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(enrollments.data ?? []).map((e, i) => {
              const p = progress.data?.[i];
              return (
                <div key={e.id} className="surface-card p-4">
                  <h3 className="font-semibold">{e.courses?.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p ? `${p.completed} of ${p.total} lessons` : "Loading progress…"}
                  </p>
                  <Progress value={p?.percent ?? 0} className="mt-3" />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary">{p?.percent ?? 0}%</span>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/courses/$courseId" params={{ courseId: e.course_id }}>
                          Course
                        </Link>
                      </Button>
                      {p?.lastLessonId && (
                        <Button asChild size="sm">
                          <Link to="/lesson/$lessonId" params={{ lessonId: p.lastLessonId }}>
                            Continue
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Live classes</h2>
          {(live.data ?? []).length === 0 ? (
            <EmptyState title="No upcoming live classes" />
          ) : (
            <div className="space-y-3">
              {(live.data ?? []).map((l) => {
                const status = liveStatus(l.scheduled_at, l.duration_minutes);
                return (
                  <div key={l.id} className="surface-card flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(l.scheduled_at)} · {l.teacher_name ?? "Faculty"}
                      </p>
                    </div>
                    {status === "live" ? (
                      <Button asChild size="sm">
                        <a href={l.join_url ?? "#"} target="_blank" rel="noreferrer">
                          LIVE NOW
                        </a>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/live">Details</Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent results</h2>
          {(attempts.data ?? []).length === 0 ? (
            <EmptyState title="No test attempts yet" description="Take a test to see your results here." />
          ) : (
            <div className="space-y-3">
              {(attempts.data ?? []).map((a) => (
                <Link
                  key={a.id}
                  to="/results"
                  className="surface-card flex items-center justify-between p-4 hover:shadow-lg"
                >
                  <div>
                    <p className="font-medium">{a.tests?.title ?? "Test"}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(a.submitted_at)}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {a.score}/{a.total}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </StudentShell>
  );
}
