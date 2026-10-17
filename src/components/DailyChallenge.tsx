 import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Flame, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/DataStates";

const COUNT = 5;

function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Same 5 questions for everyone on a given day, picked from published tests. */
function pickForDay<T extends { id: string }>(all: T[], date: string) {
  return [...all].sort((a, b) => hash(date + a.id) - hash(date + b.id)).slice(0, COUNT);
}

function computeStreak(dates: Set<string>, today: string) {
  const d = new Date();
  if (!dates.has(today)) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (dates.has(localDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function DailyChallenge({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const today = localDate();
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);

  const questions = useQuery({
    queryKey: ["daily-questions", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, solution, tests!inner(is_published)")
        .eq("tests.is_published", true);
      if (error) throw error;
      return pickForDay(data ?? [], today);
    },
  });

  const answers = useQuery({
    queryKey: ["daily-answers", userId],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 400);
      const { data, error } = await supabase
        .from("daily_challenge_answers")
        .select("challenge_date, question_id, selected_option, is_correct")
        .eq("user_id", userId)
        .gte("challenge_date", localDate(since));
      if (error) throw error;
      return data ?? [];
    },
  });

  if (questions.isLoading || answers.isLoading) {
    return <section className="surface-card p-4"><LoadingState label="Loading daily challenge…" /></section>;
  }
  if (questions.error || answers.error) {
    return (
      <section className="surface-card p-4 text-sm">
        <p className="font-semibold">Daily Challenge</p>
        <p className="mt-1 text-muted-foreground">Couldn't load today's challenge.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => { questions.refetch(); answers.refetch(); }}>Try again</Button>
      </section>
    );
  }

  const qs = questions.data ?? [];
  const all = answers.data ?? [];
  const todays = new Map(all.filter((a) => a.challenge_date === today).map((a) => [a.question_id, a]));
  const total = qs.length;
  const answered = qs.filter((q) => todays.has(q.id)).length;
  const score = qs.filter((q) => todays.get(q.id)?.is_correct).length;

  const perDay = new Map<string, number>();
  all.forEach((a) => perDay.set(a.challenge_date, (perDay.get(a.challenge_date) ?? 0) + 1));
  const doneDays = new Set([...perDay].filter(([d, n]) => n >= Math.min(COUNT, total || COUNT) || (d === today && total > 0 && answered === total)).map(([d]) => d));
  const streak = computeStreak(doneDays, today);

  const header = (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold">Daily Challenge</h2>
        <p className="text-xs text-muted-foreground">Today's score: {score}/{total}</p>
      </div>
      <span className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
        <Flame className="h-4 w-4 text-primary" /> {streak} day{streak === 1 ? "" : "s"}
      </span>
    </div>
  );

  if (total === 0) {
    return (
      <section className="surface-card p-4">
        {header}
        <p className="text-sm text-muted-foreground">No questions available yet. New challenges appear once tests are published.</p>
      </section>
    );
  }

  const idx = Math.min(current, total - 1);
  const q = qs[idx]!;
  const mine = todays.get(q.id);
  const options = (["a", "b", "c", "d"] as const)
    .map((k) => ({ key: k, text: q[`option_${k}`] as string | null }))
    .filter((o) => o.text);
  const correct = String(q.correct_option).toLowerCase();

  async function answer(opt: string) {
    if (mine || saving) return;
    setSaving(true);
    const { error } = await supabase.from("daily_challenge_answers").insert({
      user_id: userId,
      challenge_date: today,
      question_id: q.id,
      selected_option: opt,
      is_correct: opt === correct,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["daily-answers", userId] });
  }

  return (
    <section className="surface-card p-4">
      {header}
      {answered === total && (
        <p className="mb-3 rounded-md bg-accent p-2 text-sm text-accent-foreground">
          Done for today! You scored {score}/{total}. Come back tomorrow to keep your streak.
        </p>
      )}
      <div className="mb-3 flex gap-1.5">
        {qs.map((x, i) => {
          const a = todays.get(x.id);
          return (
            <button
              key={x.id}
              onClick={() => setCurrent(i)}
              aria-label={`Question ${i + 1}`}
              className={`h-8 w-8 rounded-md border text-xs font-semibold ${i === idx ? "border-primary" : "border-input"} ${a ? (a.is_correct ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive") : ""}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="font-medium">{q.question_text}</p>
      <div className="mt-3 space-y-2">
        {options.map((o) => {
          const isRight = mine && o.key === correct;
          const isWrongPick = mine && o.key === mine.selected_option && !mine.is_correct;
          return (
            <button
              key={o.key}
              disabled={!!mine || saving}
              onClick={() => answer(o.key)}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${isRight ? "border-primary bg-primary/10" : isWrongPick ? "border-destructive bg-destructive/10" : "border-input hover:bg-accent"}`}
            >
              <span><span className="mr-2 font-semibold uppercase">{o.key}.</span>{o.text}</span>
              {isRight && <CheckCircle2 className="h-4 w-4 text-primary" />}
              {isWrongPick && <XCircle className="h-4 w-4 text-destructive" />}
            </button>
          );
        })}
      </div>
      {mine && (
        <div className="mt-3 text-sm">
          <p className={mine.is_correct ? "font-semibold text-primary" : "font-semibold text-destructive"}>
            {mine.is_correct ? "Correct!" : `Wrong — correct answer is ${correct.toUpperCase()}.`}
          </p>
          {q.solution && <p className="mt-1 text-muted-foreground">{q.solution}</p>}
        </div>
      )}
      <div className="mt-4 flex justify-between">
        <Button size="sm" variant="outline" disabled={idx === 0} onClick={() => setCurrent(idx - 1)}>Previous</Button>
        <Button size="sm" disabled={idx === total - 1} onClick={() => setCurrent(idx + 1)}>Next</Button>
      </div>
    </section>
  );
                       }
