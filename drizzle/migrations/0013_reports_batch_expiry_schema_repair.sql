-- Additive repair for report replies and batch-based enrollment expiry.
-- Safe to re-run: existing records are preserved and new columns receive compatible defaults.

ALTER TABLE public.lesson_reports
  ADD COLUMN IF NOT EXISTS ai_reply text,
  ADD COLUMN IF NOT EXISTS ai_replied_at timestamptz;

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS validity_days integer NOT NULL DEFAULT 365;

ALTER TABLE public.batches
  DROP CONSTRAINT IF EXISTS batches_validity_days_check;
ALTER TABLE public.batches
  ADD CONSTRAINT batches_validity_days_check
  CHECK (validity_days BETWEEN 1 AND 3650);

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_renewal_count_check;
ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_renewal_count_check
  CHECK (renewal_count >= 0);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_of uuid REFERENCES public.payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS enrollments_user_course_expiry_idx
  ON public.enrollments (user_id, course_id, expires_at);

CREATE INDEX IF NOT EXISTS payments_renewal_of_idx
  ON public.payments (renewal_of);


-- Backfill legacy paid enrollments from their original enrollment date.
UPDATE public.enrollments e
SET purchased_at = COALESCE(e.purchased_at, e.created_at),
    expires_at = COALESCE(
      e.expires_at,
      COALESCE(e.purchased_at, e.created_at)
        + make_interval(days => COALESCE((SELECT b.validity_days FROM public.batches b WHERE b.id = e.batch_id), 365))
    )
WHERE EXISTS (
  SELECT 1 FROM public.courses c
  WHERE c.id = e.course_id AND NOT (c.is_free OR c.price = 0)
);

UPDATE public.payments
SET paid_at = COALESCE(paid_at, created_at)
WHERE status = 'paid' AND paid_at IS NULL;

-- A safe outline view preserves lesson titles on the course page without exposing
-- lesson media URLs to students whose paid access has expired.
CREATE OR REPLACE VIEW public.course_outline AS
SELECT
  s.course_id,
  s.id AS subject_id,
  s.name AS subject_name,
  s.position AS subject_position,
  ch.id AS chapter_id,
  ch.name AS chapter_name,
  ch.position AS chapter_position,
  l.id AS lesson_id,
  l.title AS lesson_title,
  l.position AS lesson_position,
  l.is_published,
  (l.video_url IS NOT NULL) AS has_video,
  (l.pdf_url IS NOT NULL) AS has_pdf
FROM public.subjects s
JOIN public.chapters ch ON ch.subject_id = s.id
JOIN public.lessons l ON l.chapter_id = ch.id
WHERE l.is_published = true;

REVOKE ALL ON public.course_outline FROM PUBLIC;
GRANT SELECT ON public.course_outline TO anon, authenticated;

-- Replace the old public lesson-media policy with course entitlement checks.
DROP POLICY IF EXISTS "lessons read" ON public.lessons;
DROP POLICY IF EXISTS "lessons read entitled" ON public.lessons;

CREATE POLICY "lessons read free courses" ON public.lessons
FOR SELECT TO anon
USING (
  is_published
  AND EXISTS (
    SELECT 1
    FROM public.chapters ch
    JOIN public.subjects s ON s.id = ch.subject_id
    JOIN public.courses c ON c.id = s.course_id
    WHERE ch.id = lessons.chapter_id AND (c.is_free OR c.price = 0)
  )
);

CREATE POLICY "lessons read entitled" ON public.lessons
FOR SELECT TO authenticated
USING (
  is_published
  AND EXISTS (
    SELECT 1
    FROM public.chapters ch
    JOIN public.subjects s ON s.id = ch.subject_id
    JOIN public.courses c ON c.id = s.course_id
    WHERE ch.id = lessons.chapter_id
      AND (
        c.is_free OR c.price = 0
        OR EXISTS (
          SELECT 1
          FROM public.enrollments e
          WHERE e.course_id = c.id
            AND e.user_id = auth.uid()
            AND e.status = 'active'
            AND (e.expires_at IS NULL OR e.expires_at > now())
        )
      )
  )
);
