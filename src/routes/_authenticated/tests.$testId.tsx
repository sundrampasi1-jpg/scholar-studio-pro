import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
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
const FEEDBACK_DELAY = 750;

function TakeTest() {
  const { testId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef<Record<string, string>>({});
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ questionId: string; option: string; correct: boolean } | null>(null);
  const submittedRef = useRef(false);
  const lockedRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const finalAnswers = answersRef.current;
    for (const q of questions) {
      total += q.marks;
      const a = finalAnswers[q.id];
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
        answers: finalAnswers,
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

  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

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
        <div className="surface-card max-w-lg space-y-3 rounded-2xl p-5">
          <p className="text-sm">
            <strong>{questions.length}</strong> questions · <strong>{test.duration_minutes}</strong>{" "}
            minutes
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>Timer starts when you press Start.</li>
            <li>Tap an option to lock your answer and move to the next question.</li>
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

  const q = questions[current]!;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = ((current + 1) / questions.length) * 100;

  function chooseOption(option: string) {
    if (lockedRef.current || !q) return;
    lockedRef.current = true;
    const nextAnswers = { ...answersRef.current, [q.id]: option };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    const isCorrect = option === q.correct_option;
    setFeedback({ questionId: q.id, option, correct: isCorrect });

    advanceTimerRef.current = setTimeout(() => {
      setFeedback(null);
      if (current < questions.length - 1) {
        setCurrent((value) => value + 1);
        lockedRef.current = false;
      } else {
        void submit();
      }
    }, FEEDBACK_DELAY);
  }

  return (
    <StudentShell>
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{test.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Question {current + 1} of {questions.length}</p>
          </div>
          <div
            className={cn(
              "flex min-w-[126px] shrink-0 items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-md transition-colors",
              remaining < 60
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-amber-300/90 bg-gradient-to-br from-amber-100 via-amber-50 to-orange-100 text-amber-900 dark:border-amber-700 dark:from-amber-950 dark:via-amber-950/80 dark:to-orange-950/70 dark:text-amber-200",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm dark:bg-black/20">
              <Clock className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Time left</span>
              <span className="text-xl font-extrabold tabular-nums tracking-wide">{mm}:{ss}</span>
            </span>
          </div>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <section className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-[0_12px_40px_-20px_rgba(180,83,9,0.35)] dark:border-amber-900 dark:from-amber-950/50 dark:via-card dark:to-orange-950/30">
          <div className="border-b border-amber-200/80 px-5 py-5 sm:px-7 sm:py-6 dark:border-amber-900">
            <div className="mb-3 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold tracking-wide text-amber-800 dark:bg-amber-900/70 dark:text-amber-200">
              QUESTION {current + 1}
            </div>
            <h2 className="whitespace-pre-wrap text-lg font-bold leading-relaxed text-slate-900 sm:text-xl dark:text-slate-50">
              {q.question_text}
            </h2>
            <p className="mt-2 text-xs font-medium text-amber-800/75 dark:text-amber-200/75">
              {q.marks} mark{q.marks > 1 ? "s" : ""} · Choose one answer
            </p>
          </div>

          <div className="space-y-3 p-4 sm:p-6">
            {OPTS.map((option, index) => {
              const optionText = q[`option_${option}` as const];
              if (!optionText) return null;
              const isChosen = feedback?.questionId === q.id && feedback.option === option;
              const showCorrect = !!feedback && option === q.correct_option;
              const showWrong = isChosen && !feedback.correct;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={lockedRef.current}
                  onClick={() => chooseOption(option)}
                  className={cn(
                    "group flex min-h-[66px] w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3.5 text-left text-sm font-medium text-slate-800 shadow-sm transition-all duration-200 sm:min-h-[72px] sm:px-5 sm:text-base dark:bg-card dark:text-card-foreground",
                    !feedback && "border-amber-100 hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:shadow-md dark:border-border dark:hover:border-amber-700 dark:hover:bg-amber-950/30",
                    showCorrect && "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
                    showWrong && "border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
                    !!feedback && !showCorrect && !showWrong && "border-slate-100 opacity-60 dark:border-border",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-bold uppercase text-amber-800 transition-colors dark:bg-amber-900/60 dark:text-amber-200",
                      showCorrect && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
                      showWrong && "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200",
                    )}
                  >
                    {showCorrect ? <CheckCircle2 className="h-5 w-5" /> : showWrong ? <XCircle className="h-5 w-5" /> : String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 leading-relaxed">{optionText}</span>
                  {showCorrect && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />}
                  {showWrong && <XCircle className="h-5 w-5 shrink-0 text-rose-600" />}
                </button>
              );
            })}
          </div>
        </section>

        <p className="text-center text-xs font-medium text-muted-foreground">
          {feedback
            ? feedback.correct
              ? "Correct answer! Moving to the next question…"
              : "Not quite. The correct answer is highlighted. Moving on…"
            : "Tap an option — the next question opens automatically."}
        </p>
        {submitting && <p className="text-center text-sm text-muted-foreground">Submitting your test…</p>}
      </div>
    </StudentShell>
  );
}
