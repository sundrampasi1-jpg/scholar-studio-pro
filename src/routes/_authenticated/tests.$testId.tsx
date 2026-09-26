import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, Flag } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tests/$testId")({
  head: () => ({
    meta: [
      { title: "Take test — JK Academy" },
      { name: "description", content: "Answer questions within the time limit." },
      { property: "og:title", content: "Take test — JK Academy" },
      { property: "og:description", content: "Answer questions within the time limit." },
    ],
  }),
  component: TakeTest,
});

const OPTS = ["a", "b", "c", "d"] as const;

function TakeTest() {
  const { testId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Record<string, boolean>>({});
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const data = useQuery({
    queryKey: ["test-take", testId],
    queryFn: async () => {
      const [{ data: test, error }, { data: qs, error: qErr }] = await Promise.all([
        supabase.from("tests").select("*").eq("id", testId).maybeSingle(),
        supabase.from("questions").select("*").eq("test_id", testId).order("position"),
      ]);
      if (error) throw error;
      if (qErr) throw qErr;
      return { test, questions: qs ?? [] };
    },
  });

  const questions = useMemo(() => data.data?.questions ?? [], [data.data]);

  async function submit() {
    if (submittedRef.current || !user || !data.data?.test) return;
    submittedRef.current = true;
    setSubmitting(true);
    let score = 0;
    let total = 0;
    let correct = 0;
    let wrong = 0;
    for (const q of questions) {
      total += q.marks;
      const a = answers[q.id];
      if (!a) continue;
      if (a === q.correct_option) {
        score += q.marks;
        correct++;
      } else wrong++;
    }
    const { data: attempt, error } = await supabase
      .from("test_attempts")
      .insert({
        user_id: user.id,
        test_id: testId,
        score,
        total,
        correct_count: correct,
        wrong_count: wrong,
        answers,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error) {
      submittedRef.current = false;
      toast.error(error.message);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: user.id,
      title: `Result: ${data.data.test.title}`,
      body: `You scored ${score}/${total}.`,
      type: "result",
      link: "/results",
    });
    queryClient.invalidateQueries({ queryKey: ["recent-attempts"] });
    queryClient.invalidateQueries({ queryKey: ["my-attempts"] });
    toast.success("Test submitted");
    navigate({ to: "/results", search: { attempt: attempt.id } });
  }

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          void submit();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (data.isLoading)
    return (
      <StudentShell>
        <LoadingState />
      </StudentShell>
    );
  if (!data.data?.test)
    return (
      <StudentShell>
        <EmptyState title="Test not found" />
      </StudentShell>
    );

  const test = data.data.test;

  if (!started) {
    return (
      <StudentShell title={test.title} subtitle={test.description ?? undefined}>
        <div className="surface-card max-w-lg space-y-3 p-5">
          <p className="text-sm">
            <strong>{questions.length}</strong> questions · <strong>{test.duration_minutes}</strong>{" "}
            minutes
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>Timer starts when you press Start.</li>
            <li>You can skip, go back, and mark questions for review.</li>
            <li>The test submits automatically when time runs out.</li>
          </ul>
          <div className="flex gap-2">
            <Button
              disabled={questions.length === 0}
              onClick={() => {
                setRemaining(test.duration_minutes * 60);
                setStarted(true);
              }}
            >
              Start test
            </Button>
            <Button asChild variant="outline">
              <Link to="/tests">Back</Link>
            </Button>
          </div>
        </div>
      </StudentShell>
    );
  }

  const q = questions[current];
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <StudentShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="truncate text-lg font-semibold">{test.title}</h1>
        <span
          className={cn(
            "flex items-center gap-1 rounded-md px-3 py-1 text-sm font-semibold",
            remaining < 60 ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground",
          )}
        >
          <Clock className="h-4 w-4" /> {mm}:{ss}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="surface-card p-5">
          <p className="text-xs font-semibold text-muted-foreground">
            Question {current + 1} of {questions.length} · {q.marks} mark{q.marks > 1 ? "s" : ""}
          </p>
          <p className="mt-2 whitespace-pre-wrap font-medium">{q.question_text}</p>
          <div className="mt-4 space-y-2">
            {OPTS.map((o) => {
              const text = q[`option_${o}` as const];
              if (!text) return null;
              const selected = answers[q.id] === o;
              return (
                <button
                  key={o}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition",
                    selected ? "border-primary bg-accent" : "hover:bg-muted",
                  )}
                >
                  <span className="font-semibold uppercase">{o}.</span> {text}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setReview((r) => ({ ...r, [q.id]: !r[q.id] }))}
            >
              <Flag className="mr-1.5 h-4 w-4" /> {review[q.id] ? "Unmark review" : "Mark for review"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAnswers((a) => {
                  const n = { ...a };
                  delete n[q.id];
                  return n;
                });
              }}
            >
              Clear
            </Button>
            {current < questions.length - 1 ? (
              <Button onClick={() => setCurrent((c) => c + 1)}>
                {answers[q.id] ? "Save & next" : "Skip"}
              </Button>
            ) : (
              <Button onClick={() => submit()} disabled={submitting}>
                Submit test
              </Button>
            )}
          </div>
        </div>

        <aside className="surface-card h-fit p-4">
          <p className="mb-3 text-sm font-medium">Questions</p>
          <div className="grid grid-cols-6 gap-2">
            {questions.map((qq, i) => (
              <button
                key={qq.id}
                onClick={() => setCurrent(i)}
                className={cn(
                  "h-9 rounded-md border text-xs font-semibold",
                  i === current && "ring-2 ring-ring",
                  review[qq.id]
                    ? "border-warning bg-warning/20"
                    : answers[qq.id]
                      ? "border-success bg-success text-success-foreground"
                      : "",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-xs text-muted-foreground">
            <p>Answered: {Object.keys(answers).length}</p>
            <p>Marked for review: {Object.values(review).filter(Boolean).length}</p>
          </div>
          <Button className="mt-4 w-full" onClick={() => submit()} disabled={submitting}>
            Submit test
          </Button>
        </aside>
      </div>
    </StudentShell>
  );
}
