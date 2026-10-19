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
    meta: [{ title: "Personalized Dashboard — JK Academy" }],
  }),
  component: Dashboard,
});

const SAGE = "#bb8428";
const IVORY = "#F5F3EE";
const GOLD = "#E7D6A9";
const LIGHT_SAGE = "#D9E5D8";
const TEXT_PRIMARY = "#263D33";
const TEXT_SECONDARY = "#73776E";
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

  const avgScore =
    attempts.data && attempts.data.length > 0
      ? Math.round(
          (attempts.data.reduce(function (s, a) {
            return s + (a.total ? (a.score / a.total) * 100 : 0);
          }, 0) /
            attempts.data.length)
        )
      : 0;

  const stats = [
    { label: "Lessons completed", value: doneLessons + "/" + totalLessons, sub: overallProgress + "% done", icon: "📘" },
    { label: "Test performance", value: avgScore + "%", sub: "Average score", icon: "🎯" },
    { label: "My batches", value: enrollments.data ? enrollments.data.length : 0, sub: "Enrolled", icon: "🎓" },
    { label: "Upcoming live", value: live.data ? live.data.length : 0, sub: "Classes", icon: "📅" },
  ];

  const studentName = user?.email ? user.email.split("@")[0] : "Student";
 return (
    <StudentShell>
      <div style={{ backgroundColor: IVORY }} className="-mx-4 -mt-20 px-4 pt-24 pb-2 md:-mt-6 md:pt-8">
        <p style={{ color: TEXT_PRIMARY }} className="text-lg font-semibold">
          Good morning, {studentName} 👋
        </p>
        <p style={{ color: TEXT_SECONDARY }} className="mt-0.5 text-sm">
          आज अपनी तैयारी को एक कदम आगे बढ़ाएँ।
        </p>

        <section
          style={{ backgroundColor: SAGE }}
          className="mt-4 rounded-2xl p-5 text-white shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-white/70">Today's goal</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-white/90">Overall progress</span>
            <span className="text-lg font-bold">{overallProgress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: overallProgress + "%" }} />
          </div>
          <p className="mt-3 text-sm text-white/80">
            {doneLessons} of {totalLessons} lessons completed
          </p>
          <Button asChild size="sm" className="mt-4 bg-white text-[#244C40] hover:bg-white/90">
            <Link to="/courses">Continue learning</Link>
          </Button>
        </section>
      </div>
     <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(function (stat) {
          return (
            <div
              key={stat.label}
              style={{ backgroundColor: "#FFFFFF", borderColor: LIGHT_SAGE }}
              className="rounded-2xl border p-4 shadow-sm"
            >
              <span
                style={{ backgroundColor: LIGHT_SAGE }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
              >
                {stat.icon}
              </span>
              <p style={{ color: TEXT_PRIMARY }} className="mt-3 text-xl font-bold">
                {stat.value}
              </p>
              <p style={{ color: TEXT_SECONDARY }} className="text-xs">
                {stat.label} · {stat.sub}
              </p>
            </div>
          );
        })}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="surface-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span style={{ backgroundColor: GOLD }} className="flex h-9 w-9 items-center justify-center rounded-xl text-lg">📄</span>
            <h2 style={{ color: TEXT_PRIMARY }} className="font-semibold">Notes & PDFs</h2>
          </div>
          <p style={{ color: TEXT_SECONDARY }} className="mt-2 text-sm">Open your batch notes and PDFs.</p>
          <Button asChild className="mt-4" size="sm" variant="outline">
            <Link to="/notes">Open notes</Link>
          </Button>
        </div>

        <div className="surface-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span style={{ backgroundColor: GOLD }} className="flex h-9 w-9 items-center justify-center rounded-xl text-lg">📝</span>
            <h2 style={{ color: TEXT_PRIMARY }} className="font-semibold">Tests</h2>
          </div>
          <p style={{ color: TEXT_SECONDARY }} className="mt-2 text-sm">Practice with available tests.</p>
          <Button asChild className="mt-4" size="sm" variant="outline">
            <Link to="/tests">Open tests</Link>
          </Button>
        </div>
      </section>
     <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 style={{ color: TEXT_PRIMARY }} className="text-lg font-semibold">My courses</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/courses">View all</Link>
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
                <div key={enrollment.id} className="surface-card p-4 shadow-sm">
                  <h3 style={{ color: TEXT_PRIMARY }} className="font-semibold">{enrollment.courses?.title}</h3>
                  <p style={{ color: TEXT_SECONDARY }} className="mt-1 text-xs">
                    {itemProgress ? itemProgress.completed + " of " + itemProgress.total + " lessons" : "Loading..."}
                  </p>
                  <Progress value={itemProgress ? itemProgress.percent : 0} className="mt-3" />
                  <div className="mt-3 flex items-center justify-between">
                    <span style={{ color: SAGE }} className="text-sm font-semibold">{itemProgress ? itemProgress.percent : 0}%</span>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/courses/$courseId" params={{ courseId: enrollment.course_id }}>Open</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
     <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section>
          <h2 style={{ color: TEXT_PRIMARY }} className="mb-3 text-lg font-semibold">Live classes</h2>
          {live.isLoading ? (
            <LoadingState />
          ) : (live.data ?? []).length === 0 ? (
            <EmptyState title="No live classes right now" />
          ) : (
            <div className="space-y-3">
              {(live.data ?? []).map(function (item) {
                const status = liveStatus(item.scheduled_at, item.duration_minutes);
                return (
                  <div key={item.id} className="surface-card flex items-center justify-between gap-3 p-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p style={{ color: TEXT_SECONDARY }} className="text-xs">{formatDateTime(item.scheduled_at)}</p>
                    </div>
                    {status === "live" ? (
                      <Button asChild size="sm"><a href={item.join_url ?? "#"} target="_blank" rel="noreferrer">LIVE NOW</a></Button>
                    ) : (
                      <Button asChild size="sm" variant="outline"><Link to="/live">Details</Link></Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ color: TEXT_PRIMARY }} className="mb-3 text-lg font-semibold">My recent tests</h2>
          {attempts.isLoading ? (
            <LoadingState />
          ) : (attempts.data ?? []).length === 0 ? (
            <EmptyState title="No tests taken yet" />
          ) : (
            <div className="space-y-3">
              {(attempts.data ?? []).map(function (attempt) {
                return (
                  <Link key={attempt.id} to="/results" className="surface-card flex items-center justify-between p-4 shadow-sm">
                    <div>
                      <p className="font-medium">{attempt.tests?.title ?? "Test"}</p>
                      <p style={{ color: TEXT_SECONDARY }} className="text-xs">{formatDateTime(attempt.submitted_at)}</p>
                    </div>
                    <span style={{ color: SAGE }} className="text-sm font-semibold">{attempt.score}/{attempt.total}</span>
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
     
     
 
