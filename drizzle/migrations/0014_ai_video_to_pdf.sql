-- AI Video-to-PDF notes: preserve teacher-uploaded PDFs in lessons.pdf_url.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ai_video_pdf_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS ai_pdf_url text,
  ADD COLUMN IF NOT EXISTS ai_pdf_source_url text;

CREATE TABLE IF NOT EXISTS public.ai_video_pdf_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  source_video_url text NOT NULL,
  pdf_url text,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ai_video_pdf_jobs_lesson_created_idx
  ON public.ai_video_pdf_jobs (lesson_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ai_video_pdf_jobs_one_active_per_lesson
  ON public.ai_video_pdf_jobs (lesson_id)
  WHERE status IN ('queued', 'processing');

ALTER TABLE public.ai_video_pdf_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ai_video_pdf_jobs TO authenticated;
GRANT ALL ON public.ai_video_pdf_jobs TO service_role;

DROP POLICY IF EXISTS "ai video pdf jobs admin read" ON public.ai_video_pdf_jobs;
CREATE POLICY "ai video pdf jobs admin read"
  ON public.ai_video_pdf_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
