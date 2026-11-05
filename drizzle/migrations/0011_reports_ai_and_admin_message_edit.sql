-- JK Academy: lesson report AI replies + staff edit/delete permissions

ALTER TABLE public.lesson_reports
  ADD COLUMN IF NOT EXISTS ai_reply text,
  ADD COLUMN IF NOT EXISTS ai_replied_at timestamptz;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.lesson_reports TO authenticated;

DROP POLICY IF EXISTS "lesson_reports staff update"
  ON public.lesson_reports;

CREATE POLICY "lesson_reports staff update"
  ON public.lesson_reports
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "lesson_reports staff delete"
  ON public.lesson_reports;

CREATE POLICY "lesson_reports staff delete"
  ON public.lesson_reports
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

GRANT UPDATE ON public.support_messages TO authenticated;

DROP POLICY IF EXISTS "support messages staff update"
  ON public.support_messages;

CREATE POLICY "support messages staff update"
  ON public.support_messages
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

GRANT UPDATE ON public.doubt_replies TO authenticated;

DROP POLICY IF EXISTS "doubt replies staff update"
  ON public.doubt_replies;

CREATE POLICY "doubt replies staff update"
  ON public.doubt_replies
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
