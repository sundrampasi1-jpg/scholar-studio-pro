 import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  FileQuestion,
  Radio,
  CalendarClock,
  FileText,
  ClipboardList,
} from "lucide-react";
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
      {
        name: "description",
        content: "Your batches, live classes, notes, tests and study progress.",
      },
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
    queryKey: [
      "all-progress",
      uid,
      enrollments.data?.map((e) => e.course_id).join(","),
    ],
    enabled: !!uid && !!enrollments.data,
    queryFn: async () =>
      Promise.all(
        (enrollments.data ?? []).map((e) =>
          fetchCourseProgress(uid!, e.course_id),
        ),
      ),
  });

  const live = useQuery({
    queryKey: ["upcoming-live", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_classes")
        .select("*")
        .gte(
          "scheduled_at",
          new Date(Date.now() - 3 * 3600_000).toISOString(),
        )
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

  const totalLessons = (progress.data ?? []).reduce(
    (sum, item) => sum + item.total,
    0,
  );
  const doneLessons = (progress.data ?? []).reduce(
    (sum, item) => sum + item.completed,
    0,
  );

  const overallProgress =
    totalLessons > 0
      ? Math.round((doneLessons / totalLessons) * 100)
      : 0;

  const nextLive = live.data?.[0];

  const stats = [
    {
      label: "मेरे बैच",
      value: enrollments.data?.length ?? 0,
      emoji: "📚",
      grad: "from-amber-400 to-orange-500",
    },
    {
      label: "पूरे किए गए लेसन",
      value: `${doneLessons}/${totalLessons}`,
      emoji: "✅",
      grad: "from-emerald-400 to-teal-500",
    },
    {
      label: "दिए गए टेस्ट",
      value: attempts.data?.length ?? 0,
      emoji: "📝",
      grad: "from-sky-400 to-blue-500",
    },
    {
      label: "आने वाली लाइव क्लास",
      value: live.data?.length ?? 0,
      emoji: "🔴",
      grad: "from-rose-400 to-pink-500",
    },
  ];

  return (
    <StudentShell>
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.5_0.14_55)] p-6 text-primary-foreground shadow-lg">
        <p className="text-xs font-semibold tracking-wide opacity-80">JK ACADEMY • STUDENT OVERVIEW</p>
        <h2 className="mt-1 text-2xl font-bold">आपकी पढ़ाई का डैशबोर्ड ✨</h2>
        <p className="mt-1 text-sm opacity-90">अपने बैच, अगली लाइव क्लास और पढ़ाई की प्रगति यहाँ देखें।</p>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl bg-gradient-to-br ${stat.grad} p-4 text-white shadow-md transition-transform active:scale-95`}
            >
              <span className="text-2xl">{stat.emoji}</span>
              <p className="mt-2 text-xl font-bold">{stat.value}</p>
              <p className="text-xs font-medium opacity-90">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="surface-card overflow-hidden p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">⏰</span>
            <h2 className="font-semibold">अगली लाइव क्लास</h2>
          </div>

          {live.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">लाइव क्लास की जानकारी लोड हो रही है...</p>
          ) : live.error ? (
            <p className="mt-3 text-sm text-muted-foreground">लाइव क्लास की जानकारी अभी उपलब्ध नहीं है।</p>
          ) : nextLive ? (
            <>
              <p className="mt-3 font-medium">{nextLive.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(nextLive.scheduled_at)}</p>
              <Button asChild className="mt-4" size="sm" variant="outline">
                <Link to="/live">क्लास देखें</Link>
              </Button>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">अभी कोई आने वाली लाइव क्लास नहीं है।</p>
          )}
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">📈</span>
            <h2 className="font-semibold">मेरी पढ़ाई की प्रगति</h2>
          </div>

          {progress.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">आपकी प्रगति लोड हो रही है...</p>
          ) : (
            <>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">कुल प्रगति</span>
                <span className="font-semibold">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="mt-2" />
              <p className="mt-2 text-sm text-muted-foreground">
                {doneLessons} में से {totalLessons} लेसन पूरे हुए।
              </p>
            </>
          )}
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">📄</span>
            <h2 className="font-semibold">नए नोट्स</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">अपने बैच के उपलब्ध नोट्स और PDF पढ़ने के लिए कोर्स खोलें।</p>
          <Button asChild className="mt-4" size="sm" variant="outline">
            <Link to="/courses">मेरे बैच खोलें</Link>
          </Button>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl">📝</span>
            <h2 className="font-semibold">टेस्ट और अभ्यास</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">अपने बैच में उपलब्ध टेस्ट खोलें और अभ्यास जारी रखें।</p>
          <Button asChild className="mt-4" size="sm" variant="outline">
            <Link to="/courses">टेस्ट के लिए बैच खोलें</Link>
          </Button>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">मेरे बैच और कोर्स</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/courses">सभी कोर्स</Link>
          </Button>
        </div>

        {enrollments.isLoading ? (
          <LoadingState />
        ) : enrollments.error ? (
          <ErrorState error={enrollments.error} onRetry={() => enrollments.refetch()} />
        ) : (enrollments.data ?? []).length === 0 ? (
          <EmptyState
            title="आपने अभी किसी कोर्स में नामांकन नहीं किया है"
            description="कोर्स कैटलॉग खोलकर उपलब्ध बैच देखें।"
            action={
              <Button asChild className="mt-3">
                <Link to="/courses">कोर्स देखें</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(enrollments.data ?? []).map((enrollment, index) => {
              const itemProgress = progress.data?.[index];

              return (
                <div key={enrollment.id} className="surface-card p-4">
                  <h3 className="font-semibold">{enrollment.courses?.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {itemProgress ? `${itemProgress.completed} में से ${itemProgress.total} लेसन` : "प्रगति लोड हो रही है..."}
                  </p>
                  <Progress value={itemProgress?.percent ?? 0} className="mt-3" />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary">{itemProgress?.percent ?? 0}%</span>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/courses/$courseId" params={{ courseId: enrollment.course_id }}>
                          कोर्स खोलें
                        </Link>
                      </Button>
                      {itemProgress?.lastLessonId && (
                        <Button asChild size="sm">
                          <Link to="/lesson/$lessonId" params={{ lessonId: itemProgress.lastLessonId }}>
                            आगे पढ़ें
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
          <h2 className="mb-3 text-lg font-semibold">लाइव क्लास</h2>

          {live.isLoading ? (
            <LoadingState />
          ) : live.error ? (
            <ErrorState error={live.error} onRetry={() => live.refetch()} />
          ) : (live.data ?? []).length === 0 ? (
            <EmptyState title="अभी कोई लाइव क्लास नहीं है" />
          ) : (
            <div className="space-y-3">
              {(live.data ?? []).map((item) => {
                const status = liveStatus(item.scheduled_at, item.duration_minutes);

                return (
                  <div key={item.id} className="surface-card flex items-center justify-between gap-3 p-4">
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
                        <Link to="/live">जानकारी</Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">मेरे हाल के टेस्ट</h2>

          {attempts.isLoading ? (
            <LoadingState />
          ) : attempts.error ? (
            <ErrorState error={attempts.error} onRetry={() => attempts.refetch()} />
          ) : (attempts.data ?? []).length === 0 ? (
            <EmptyState title="अभी कोई टेस्ट नहीं दिया गया" description="अपने बैच में उपलब्ध टेस्ट से अभ्यास शुरू करें।" />
          ) : (
            <div className="space-y-3">
              {(attempts.data ?? []).map((attempt) => (
                <Link key={attempt.id} to="/results" className="surface-card flex items-center justify-between p-4 hover:shadow-lg">
                  <div>
                    <p className="font-medium">{attempt.tests?.title ?? "टेस्ट"}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(attempt.submitted_at)}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{attempt.score}/{attempt.total}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </StudentShell>
  );
     }
