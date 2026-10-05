CREATE TABLE public.daily_challenge_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_date date NOT NULL,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option text NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_date, question_id)
);
GRANT SELECT, INSERT ON public.daily_challenge_answers TO authenticated;
GRANT ALL ON public.daily_challenge_answers TO service_role;
ALTER TABLE public.daily_challenge_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily own select" ON public.daily_challenge_answers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "daily own insert" ON public.daily_challenge_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX daily_challenge_user_date ON public.daily_challenge_answers (user_id, challenge_date);