-- JK Academy: staff delete permissions for support chat and doubt replies
GRANT DELETE ON public.support_messages TO authenticated;
CREATE POLICY "support messages staff delete"
  ON public.support_messages
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

GRANT DELETE ON public.doubt_replies TO authenticated;
CREATE POLICY "doubt replies staff delete"
  ON public.doubt_replies
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));
