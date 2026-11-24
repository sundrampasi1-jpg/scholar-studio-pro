-- In-app teacher broadcast and live-class questions.
ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS live_status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS room_name text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_classes_live_status_check') THEN
    ALTER TABLE public.live_classes
      ADD CONSTRAINT live_classes_live_status_check
      CHECK (live_status IN ('scheduled', 'live', 'ended'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.live_class_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.live_class_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  is_teacher_reply boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_class_comments_class_created_idx
  ON public.live_class_comments(live_class_id, created_at);

ALTER TABLE public.live_class_comments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_class_comments TO authenticated;

DROP POLICY IF EXISTS "live class comments read for class members" ON public.live_class_comments;
CREATE POLICY "live class comments read for class members"
ON public.live_class_comments FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.live_classes lc
    WHERE lc.id = live_class_comments.live_class_id
      AND (
        (lc.batch_id IS NULL AND (lc.course_id IS NULL OR public.has_active_course_access(auth.uid(), lc.course_id)))
        OR EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.user_id = auth.uid()
            AND e.batch_id = lc.batch_id
            AND e.status = 'active'
            AND e.expires_at > now()
        )
      )
  )
);

DROP POLICY IF EXISTS "students ask live class questions" ON public.live_class_comments;
CREATE POLICY "students ask live class questions"
ON public.live_class_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND is_teacher_reply = false
  AND EXISTS (
    SELECT 1 FROM public.live_classes lc
    WHERE lc.id = live_class_comments.live_class_id
      AND lc.live_status = 'live'
      AND (
        (lc.batch_id IS NULL AND (lc.course_id IS NULL OR public.has_active_course_access(auth.uid(), lc.course_id)))
        OR EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.user_id = auth.uid()
            AND e.batch_id = lc.batch_id
            AND e.status = 'active'
            AND e.expires_at > now()
        )
      )
  )
);

DROP POLICY IF EXISTS "staff reply to live class questions" ON public.live_class_comments;
CREATE POLICY "staff reply to live class questions"
ON public.live_class_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND is_teacher_reply = true
  AND public.is_staff(auth.uid())
);

DROP POLICY IF EXISTS "staff moderate live class questions" ON public.live_class_comments;
CREATE POLICY "staff moderate live class questions"
ON public.live_class_comments FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff delete live class questions" ON public.live_class_comments;
CREATE POLICY "staff delete live class questions"
ON public.live_class_comments FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));
