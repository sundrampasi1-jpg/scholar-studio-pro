import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/tests/")({
  head: () => ({
    meta: [
      { title: "Tests — JK Academy" },
      { name: "description", content: "Timed MCQ tests with instant results." },
      { property: "og:title", content: "Tests — JK Academy" },
      { property: "og:description", content: "Timed MCQ tests with instant results." },
    ],
  }),
  component: TestsPage,
});

function TestsPage() {
  const { user } = useAuth();
  const tests = useQuery({
    queryKey: ["tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tests")
        .select("*, courses(title), questions(count)")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const attempts = useQuery({
    queryKey: ["my-attempt-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("test_attempts").select("test_id").eq("user_id", user!.id);
      return (data ?? []).map((a) => a.test_id);
    },
  });

  return (
    <StudentShell
      title="Tests"
      subtitle="Practice with timed tests"
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/results">My results</Link>
        </Button>
      }
    >
      {tests.isLoading ? (
        <LoadingState />
      ) : tests.error ? (
        <ErrorState error={tests.error} onRetry={() => tests.refetch()} />
      ) : (tests.data ?? []).length === 0 ? (
        <EmptyState title="No tests available yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(tests.data ?? []).map((t) => {
            const qCount = (t.questions as unknown as { count: number }[])?.[0]?.count ?? 0;
            const attempted = attempts.data?.includes(t.id);
            return (
              <div key={t.id} className="surface-card p-4">
                <h3 className="font-semibold">{t.title}</h3>
                <p className="text-xs text-muted-foreground">{t.courses?.title ?? "General"}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {t.duration_minutes} min · {qCount} questions
                  </span>
                  <Button asChild size="sm" disabled={qCount === 0}>
                    <Link to="/tests/$testId" params={{ testId: t.id }}>
                      {attempted ? "Reattempt" : "Start test"}
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StudentShell>
  );
}
