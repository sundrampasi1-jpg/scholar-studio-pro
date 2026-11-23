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
