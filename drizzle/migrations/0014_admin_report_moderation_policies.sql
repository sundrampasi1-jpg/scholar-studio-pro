-- Allow staff to edit/delete student lesson comments and delete reports from admin tools.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='lesson_comments' AND policyname='lesson_comments staff update any'
  ) THEN
    CREATE POLICY "lesson_comments staff update any"
      ON public.lesson_comments FOR UPDATE TO authenticated
      USING (public.is_staff(auth.uid()))
      WITH CHECK (public.is_staff(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='lesson_reports' AND policyname='lesson_reports staff delete'
  ) THEN
    CREATE POLICY "lesson_reports staff delete"
      ON public.lesson_reports FOR DELETE TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $$;
