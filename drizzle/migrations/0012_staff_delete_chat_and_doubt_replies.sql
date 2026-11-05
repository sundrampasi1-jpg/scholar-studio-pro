-- JK Academy: staff and owner delete permissions; safe to re-run.
GRANT DELETE ON public.support_messages TO authenticated;
DROP POLICY IF EXISTS "support messages staff delete" ON public.support_messages;
CREATE POLICY "support messages staff delete" ON public.support_messages
  FOR DELETE TO authenticated
  USING (
    (public.is_staff(auth.uid()) AND from_staff = true)
    OR (student_id = auth.uid() AND sender_id = auth.uid() AND from_staff = false)
  );

GRANT DELETE ON public.doubt_replies TO authenticated;
DROP POLICY IF EXISTS "doubt replies staff delete" ON public.doubt_replies;
CREATE POLICY "doubt replies staff delete" ON public.doubt_replies
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid());
