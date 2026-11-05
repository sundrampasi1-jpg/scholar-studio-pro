-- JK Academy: repair support chat schema and add safe staff edit permissions.
-- This is intentionally idempotent because some installations missed migration 0004.

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  from_staff boolean NOT NULL DEFAULT false,
  is_ai boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS support_messages_student_created_idx
  ON public.support_messages (student_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

DROP POLICY IF EXISTS "read own or staff" ON public.support_messages;
CREATE POLICY "read own or staff" ON public.support_messages
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "write own or staff" ON public.support_messages;
CREATE POLICY "write own or staff" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (student_id = auth.uid() AND from_staff = false)
      OR (public.is_staff(auth.uid()) AND from_staff = true)
    )
  );

DROP POLICY IF EXISTS "support messages staff update" ON public.support_messages;
CREATE POLICY "support messages staff update" ON public.support_messages
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) AND from_staff = true)
  WITH CHECK (public.is_staff(auth.uid()) AND from_staff = true);

DROP POLICY IF EXISTS "support messages owner update" ON public.support_messages;
CREATE POLICY "support messages owner update" ON public.support_messages
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND sender_id = auth.uid() AND from_staff = false)
  WITH CHECK (student_id = auth.uid() AND sender_id = auth.uid() AND from_staff = false);

ALTER TABLE public.lesson_reports
  ADD COLUMN IF NOT EXISTS ai_reply text,
  ADD COLUMN IF NOT EXISTS ai_replied_at timestamptz;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_reports TO authenticated;

DROP POLICY IF EXISTS "lesson_reports staff update" ON public.lesson_reports;
CREATE POLICY "lesson_reports staff update" ON public.lesson_reports
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "lesson_reports staff delete" ON public.lesson_reports;
CREATE POLICY "lesson_reports staff delete" ON public.lesson_reports
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

GRANT UPDATE ON public.doubt_replies TO authenticated;
DROP POLICY IF EXISTS "doubt replies staff update" ON public.doubt_replies;
CREATE POLICY "doubt replies staff update" ON public.doubt_replies
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Add chat table to realtime only when it is not already published.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  END IF;
END $$;
