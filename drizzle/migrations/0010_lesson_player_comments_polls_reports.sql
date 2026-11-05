-- Lesson player: comments with AI teacher replies, polls, reports; staff/owner delete for chats & doubts
CREATE TABLE public.lesson_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.lesson_comments(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Student',
  body text NOT NULL,
  is_ai boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.lesson_comments TO authenticated;
GRANT ALL ON public.lesson_comments TO service_role;
ALTER TABLE public.lesson_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_comments read" ON public.lesson_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "lesson_comments insert own" ON public.lesson_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND is_ai = false);
CREATE POLICY "lesson_comments delete own" ON public.lesson_comments FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lesson_comments staff delete any" ON public.lesson_comments FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.lesson_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.lesson_polls TO authenticated;
GRANT ALL ON public.lesson_polls TO service_role;
ALTER TABLE public.lesson_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_polls read" ON public.lesson_polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "lesson_polls staff write" ON public.lesson_polls FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "lesson_polls staff delete" ON public.lesson_polls FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.lesson_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.lesson_polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, DELETE ON public.lesson_poll_options TO authenticated;
GRANT ALL ON public.lesson_poll_options TO service_role;
ALTER TABLE public.lesson_poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_poll_options read" ON public.lesson_poll_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "lesson_poll_options staff write" ON public.lesson_poll_options FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "lesson_poll_options staff delete" ON public.lesson_poll_options FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.lesson_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.lesson_polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.lesson_poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.lesson_poll_votes TO authenticated;
GRANT ALL ON public.lesson_poll_votes TO service_role;
ALTER TABLE public.lesson_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_poll_votes read" ON public.lesson_poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "lesson_poll_votes insert own" ON public.lesson_poll_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "lesson_poll_votes delete own" ON public.lesson_poll_votes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.lesson_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.lesson_reports TO authenticated;
GRANT ALL ON public.lesson_reports TO service_role;
ALTER TABLE public.lesson_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_reports read own or staff" ON public.lesson_reports FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "lesson_reports insert own" ON public.lesson_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "lesson_reports staff update" ON public.lesson_reports FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

-- Long-press delete: owner or staff can delete chat messages and doubt replies (incl. AI rows)
CREATE POLICY "support messages owner or staff delete" ON public.support_messages FOR DELETE TO authenticated USING (student_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "doubt replies owner or staff delete" ON public.doubt_replies FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));