import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, XCircle } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/results")({
  validateSearch: z.object({ attempt: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "My results — JK Academy" },
      { name: "description", content: "Your test scores, answers and solutions." },
      { property: "og:title", content: "My results — JK Academy" },
      { property: "og:description", content: "Your test scores, answers and solutions." },
    ],
  }),
  component: Results,
});

function Results() {
  const { user } = useAuth();
  const { attempt } = Route.useSearch();

  const attempts = useQuery({
    queryKey: ["my-attempts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_attempts")
        .select("*, tests(title)")
        .eq("user_id", user!.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selected = attempts.data?.find((a) => a.id === attempt);

  const detail = useQuery({
    queryKey: ["attempt-detail", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("questions")
        .select("*")
        .eq("test_id", selected!.test_id)
        .order("position");
      return data ?? [];
    },
  });

  if (attempts.isLoading)
    return (
      <StudentShell title="My results">
        <LoadingState />
      </StudentShell>
    );

  if (selected) {
    const answers = (selected.answers ?? {}) as Record<string, string>;
    const pct = selected.total ? Math.round((selected.score / selected.total) * 100) : 0;
    return (
      <StudentShell
        title={selected.tests?.title ?? "Result"}
        subtitle={formatDateTime(selected.submitted_at)}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/results" search={{}}>
              All results
            </Link>
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Score", `${selected.score}/${selected.total}`],
            ["Percentage", `${pct}%`],
            ["Correct", selected.correct_count],
            ["Wrong", selected.wrong_count],
          ].map(([k, v]) => (
            <div key={String(k)} className="surface-card p-4">
              <p className="text-xl font-semibold">{v}</p>
              <p className="text-xs text-muted-foreground">{k}</p>
            </div>
          ))}
        </div>
        <h2 className="mb-3 mt-6 font-semibold">Answers & solutions</h2>
        {detail.isLoading ? (
          <LoadingState />
        ) : (
          <div className="space-y-3">
            {(detail.data ?? []).map((q, i) => {
              const mine = answers[q.id];
              const ok = mine === q.correct_option;
              return (
                <div key={q.id} className="surface-card p-4">
                  <div className="flex items-start gap-2">
                    {ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <p className="font-medium">
                      {i + 1}. {q.question_text}
                    </p>
                  </div>
                  <div className="mt-2 grid gap-1 text-sm">
                    {(["a", "b", "c", "d"] as const).map((o) => {
                      const t = q[`option_${o}` as const];
                      if (!t) return null;
                      return (
                        <p
                          key={o}
                          className={cn(
                            "rounded px-2 py-1",
                            o === q.correct_option && "bg-success/15 font-medium",
                            o === mine && !ok && "bg-destructive/10",
                          )}
                        >
                          {o.toUpperCase()}. {t}
                        </p>
                      );
                    })}
                  </div>
                  {!mine && <p className="mt-2 text-xs text-muted-foreground">Not answered</p>}
                  {q.solution && (
                    <p className="mt-2 rounded-md bg-muted p-2 text-sm">
                      <strong>Solution:</strong> {q.solution}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </StudentShell>
    );
  }

  return (
    <StudentShell title="My results" subtitle="Your test attempt history">
      {(attempts.data ?? []).length === 0 ? (
        <EmptyState
          title="No attempts yet"
          action={
            <Button asChild className="mt-3">
              <Link to="/tests">Browse tests</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {(attempts.data ?? []).map((a) => (
            <Link
              key={a.id}
              to="/results"
              search={{ attempt: a.id }}
              className="surface-card flex items-center justify-between p-4 hover:shadow-lg"
            >
              <div>
                <p className="font-medium">{a.tests?.title}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(a.submitted_at)}</p>
              </div>
              <span className="font-semibold text-primary">
                {a.score}/{a.total}
              </span>
            </Link>
          ))}
        </div>
      )}
    </StudentShell>
  );
}
