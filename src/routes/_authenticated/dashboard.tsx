 import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchCourseProgress, fetchMyEnrollments, formatDateTime, liveStatus } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Personalized Dashboard — JK Academy" },
      { name: "description", content: "Your batches, live classes, notes, tests and study progress." },
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
    queryFn: async () => Promise.all((enrollments.data ?? []).map((e) => fetchCourseProgress(uid!, e.course_id))),
  });

  const live = useQuery({
    queryKey: ["upcoming-live", uid],
    enabled: !!uid,
    queryFn: async () => {
      const result = await supabase
        .from("live_classes")
        .select("*")
        .gte("scheduled_at", new Date(Date.now() - 3 * 3600000).toISOString())
        .order("scheduled_at")
        .limit(3);
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const attempts = useQuery({
    queryKey: ["recent-attempts", uid],
    enabled: !!uid,
    queryFn: async () => {
      const result = await supabase
        .from("test_attempts")
        .select("id, score, total, submitted_at, tests(title)")
        .eq("user_id", uid!)
        .order("submitted_at", { ascending: false })
        .limit(3);
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const totalLessons = (progress.data ?? []).reduce(function (sum, item) {
    return sum + item.total;
  }, 0);
  const doneLessons = (progress.data ?? []).reduce(function (sum, item) {
    return sum + item.completed;
  }, 0);
  const overallProgress = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;
  const nextLive = live.data ? live.data[0] : undefined;

  const stats = [
    { label: "My batches", value: enrollments.data ? enrollments.data.length : 0, emoji: "📚", grad: "from-amber-400 to-orange-500" },
    { label: "Lessons completed", value: doneLessons + "/" + totalLessons, emoji: "✅", grad: "from-emerald-400 to-teal-500" },
    { label: "Tests taken", value: attempts.data ? attempts.data.length : 0, emoji: "📝", grad: "from-sky-400 to-blue-500" },
    { label: "Upcoming live classes", value: live.data ? live.data.length : 0, emoji: "🔴", grad: "from-rose-400 to-pink-500" },
  ];

  return (
    <StudentShell>
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.5_0.14_55)] p-6 text-primary-foreground shadow-lg">
        <p className="text-xs font-semibold tracking-wide opacity-80">JK ACADEMY STUDENT OVERVIEW</p>
        <h2 className="mt-1 text-2xl font-bold">Your study dashboard</h2>
        <p className="mt-1 text-sm opacity-90">See your batches, next live class and study progress here.</p>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(function (stat) {
            return (
              <div key={stat.label} className={"rounded-2xl bg-gradient-to-br " + stat.grad + " p-4 text-white shadow-md transition-transform active:scale-95"}>
                <span className="text-2xl">{stat.emoji}</span>
                <p className="mt-2 text-xl font-bold">{stat.value}</p>
                <p className="text-xs font-medium opacity-90">{stat.label}</p>
              </div>
            );
          })}
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
            <div>
              <p className="mt-3 font-medium">{nextLive.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(nextLive.scheduled_at)}</p>
              <Button asChild className="mt-4" size="sm" variant="outline">
                <Link to="/live">View class</Link>
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No upcoming live classes right now.</p>
          )}
        </div>

        <div className="surface-card p-5 shadow-md">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">📈</span>
            <h2 className="font-semibold">My study progress</h2>
          </div>
          {progress.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading your progress...</p>
          ) : (
            <div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overall progress</span>
                <span className="font-semibold">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="mt-2" />
              <p className="mt-2 text-sm text-muted-foreground">{doneLessons} of {totalLessons} lessons completed.</p>
            </div>
          )}
        </div>

        <div className="surface-card p-5 shadow-md">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">📄</span>
            <h2 className="font-semibold">New notes</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Open a course to read the available notes and PDFs for your batch.</p>
          <Button asChild className="mt-4" size="sm" variant="outline">
            <Link to="/courses">Open my batches</Link>
          </Button>
        </div>

        <div className="surface-card p-5 shadow-md">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">📝</span>
            <h2 className="font-semibold">Tests and practice</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Open the tests available in your batch and keep practicing.</p>
          <Button asChild className="mt-4" size="sm" variant="outline">
            <Link to="/courses">Open batch for tests</Link>
          </Button>
        </div>
      </section>
     <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My batches and courses</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/courses">All courses</Link>
          </Button>
        </div>

        {enrollments.isLoading ? (
          <LoadingState />
        ) : enrollments.error ? (
          <ErrorState error={enrollments.error} onRetry={function () { enrollments.refetch(); }} />
        ) : (enrollments.data ?? []).length === 0 ? (
          <EmptyState
            title="You haven't enrolled in any course yet"
            description="Open the course catalog to see available batches."
            action={
              <Button asChild className="mt-3">
                <Link to="/courses">View courses</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(enrollments.data ?? []).map(function (enrollment, index) {
              const itemProgress = progress.data ? progress.data[index] : undefined;
              return (
                <div key={enrollment.id} className="surface-card p-4 shadow-md">
                  <h3 className="font-semibold">{enrollment.courses?.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {itemProgress ? itemProgress.completed + " of " + itemProgress.total + " lessons" : "Loading progress..."}
                  </p>
                  <Progress value={itemProgress ? itemProgress.percent : 0} className="mt-3" />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary">{itemProgress ? itemProgress.percent : 0}%</span>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/courses/$courseId" params={{ courseId: enrollment.course_id }}>
                          Open course
                        </Link>
                      </Button>
                      {itemProgress?.lastLessonId && (
                        <Button asChild size="sm">
                          <Link to="/lesson/$lessonId" params={{ lessonId: itemProgress.lastLessonId }}>
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
          {live.isLoading ? (
            <LoadingState />
          ) : live.error ? (
            <ErrorState error={live.error} onRetry={function () { live.refetch(); }} />
          ) : (live.data ?? []).length === 0 ? (
            <EmptyState title="No live classes right now" />
          ) : (
            <div className="space-y-3">
              {(live.data ?? []).map(function (item) {
                const status = liveStatus(item.scheduled_at, item.duration_minutes);
                return (
                  <div key={item.id} className="surface-card flex items-center justify-between gap-3 p-4 shadow-md">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(item.scheduled_at)} · {item.teacher_name ?? "Faculty"}
                      </p>
                    </div>
                    {status === "live" ? (
                      <Button asChild size="sm">
                        <a href={item.join_url ?? "#"} target="_blank" rel="noreferrer">
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
          <h2 className="mb-3 text-lg font-semibold">My recent tests</h2>
          {attempts.isLoading ? (
            <LoadingState />
          ) : attempts.error ? (
            <ErrorState error={attempts.error} onRetry={function () { attempts.refetch(); }} />
          ) : (attempts.data ?? []).length === 0 ? (
            <EmptyState title="No tests taken yet" description="Start practicing with the tests available in your batch." />
          ) : (
            <div className="space-y-3">
              {(attempts.data ?? []).map(function (attempt) {
                return (
                  <Link key={attempt.id} to="/results" className="surface-card flex items-center justify-between p-4 shadow-md hover:shadow-lg">
                    <div>
                      <p className="font-medium">{attempt.tests?.title ?? "Test"}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(attempt.submitted_at)}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">{attempt.score}/{attempt.total}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </StudentShell>
  );
                 }
