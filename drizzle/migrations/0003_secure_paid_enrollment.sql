DROP POLICY "enroll insert own" ON public.enrollments;
CREATE POLICY "enroll insert own free or staff" ON public.enrollments FOR INSERT TO authenticated
WITH CHECK (is_staff(auth.uid()) OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND (c.is_free OR c.price = 0))));
DROP POLICY "payments insert own" ON public.payments;
UPDATE public.courses SET price = 2 WHERE is_free = false;