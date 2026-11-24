-- JK Academy: reports, batch-scoped live classes, and paid-course expiry.
-- Safe additive migration. The same schema/policy changes have already been
-- applied to the connected Lovable production database.

ALTER TABLE public.lesson_reports
  ADD COLUMN IF NOT EXISTS ai_reply text,
  ADD COLUMN IF NOT EXISTS ai_replied_at timestamptz;

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS validity_days integer NOT NULL DEFAULT 365;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batches_validity_days_range') THEN
    ALTER TABLE public.batches
      ADD CONSTRAINT batches_validity_days_range CHECK (validity_days BETWEEN 1 AND 3650);
  END IF;
END $$;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_of uuid,
  ADD COLUMN IF NOT EXISTS batch_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_renewal_of_fkey') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_renewal_of_fkey
      FOREIGN KEY (renewal_of) REFERENCES public.payments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_batch_id_fkey') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.payments
SET paid_at = created_at
WHERE status = 'paid' AND paid_at IS NULL;

UPDATE public.enrollments e
SET purchased_at = COALESCE(
      e.purchased_at,
      (SELECT COALESCE(p.paid_at, p.created_at)
       FROM public.payments p
       WHERE p.user_id = e.user_id AND p.course_id = e.course_id AND p.status = 'paid'
       ORDER BY COALESCE(p.paid_at, p.created_at) DESC LIMIT 1)
    ),
    expires_at = COALESCE(
      e.expires_at,
      (SELECT COALESCE(p.paid_at, p.created_at) + make_interval(days => COALESCE(b.validity_days, 365))
       FROM public.payments p
       LEFT JOIN public.batches b ON b.id = COALESCE(p.batch_id, e.batch_id)
       WHERE p.user_id = e.user_id AND p.course_id = e.course_id AND p.status = 'paid'
       ORDER BY COALESCE(p.paid_at, p.created_at) DESC LIMIT 1)
    )
WHERE e.status = 'active'
  AND e.expires_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.user_id = e.user_id AND p.course_id = e.course_id AND p.status = 'paid'
  );

CREATE OR REPLACE FUNCTION public.has_active_course_access(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id
      AND (
        c.is_free = true OR c.price = 0
        OR EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.user_id = _user_id AND e.course_id = c.id
            AND e.status = 'active'
            AND e.expires_at IS NOT NULL
            AND e.expires_at > now()
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.has_active_course_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_course_access(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "lessons read" ON public.lessons;
CREATE POLICY "lessons read enrolled or staff"
ON public.lessons FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR (
    is_published
    AND EXISTS (
      SELECT 1 FROM public.chapters ch
      JOIN public.subjects s ON s.id = ch.subject_id
      WHERE ch.id = lessons.chapter_id
        AND public.has_active_course_access(auth.uid(), s.course_id)
    )
  )
);

DROP POLICY IF EXISTS "notes read" ON public.notes;
CREATE POLICY "notes read enrolled or staff"
ON public.notes FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR COALESCE(
    course_id,
    (SELECT s.course_id FROM public.subjects s WHERE s.id = notes.subject_id),
    (SELECT s.course_id FROM public.chapters ch JOIN public.subjects s ON s.id = ch.subject_id WHERE ch.id = notes.chapter_id),
    (SELECT s.course_id FROM public.lessons l JOIN public.chapters ch ON ch.id = l.chapter_id JOIN public.subjects s ON s.id = ch.subject_id WHERE l.id = notes.lesson_id)
  ) IS NULL
  OR public.has_active_course_access(auth.uid(), COALESCE(
    course_id,
    (SELECT s.course_id FROM public.subjects s WHERE s.id = notes.subject_id),
    (SELECT s.course_id FROM public.chapters ch JOIN public.subjects s ON s.id = ch.subject_id WHERE ch.id = notes.chapter_id),
    (SELECT s.course_id FROM public.lessons l JOIN public.chapters ch ON ch.id = l.chapter_id JOIN public.subjects s ON s.id = ch.subject_id WHERE l.id = notes.lesson_id)
  ))
);

DROP POLICY IF EXISTS "tests read" ON public.tests;
CREATE POLICY "tests read enrolled or staff"
ON public.tests FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR (is_published AND (course_id IS NULL OR public.has_active_course_access(auth.uid(), course_id)))
);

DROP POLICY IF EXISTS "questions read" ON public.questions;
CREATE POLICY "questions read enrolled or staff"
ON public.questions FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = questions.test_id AND t.is_published
      AND (t.course_id IS NULL OR public.has_active_course_access(auth.uid(), t.course_id))
  )
);

DROP POLICY IF EXISTS "live read" ON public.live_classes;
CREATE POLICY "live read matching batch or general"
ON public.live_classes FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR (
    batch_id IS NULL
    AND (course_id IS NULL OR public.has_active_course_access(auth.uid(), course_id))
  )
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.user_id = auth.uid()
      AND e.batch_id = live_classes.batch_id
      AND e.status = 'active'
      AND e.expires_at > now()
  )
);
