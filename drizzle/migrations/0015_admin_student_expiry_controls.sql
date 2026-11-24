-- Keep the existing course access gate consistent with per-student admin suspension.
-- A suspended enrollment blocks even a free course for that specific student.
CREATE OR REPLACE FUNCTION public.has_active_course_access(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = _course_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.enrollments e
          WHERE e.user_id = _user_id
            AND e.course_id = c.id
            AND e.status = 'active'
            AND e.expires_at IS NOT NULL
            AND e.expires_at > now()
        )
        OR (
          (c.is_free = true OR c.price = 0)
          AND NOT EXISTS (
            SELECT 1
            FROM public.enrollments e
            WHERE e.user_id = _user_id
              AND e.course_id = c.id
              AND e.status = 'suspended'
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_course_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_course_access(uuid, uuid) TO authenticated, service_role;
