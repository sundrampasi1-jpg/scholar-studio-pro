create policy "media read authenticated" on storage.objects for select to authenticated
  using (bucket_id = 'media');
create policy "media staff write" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (public.is_staff(auth.uid()) or (storage.foldername(name))[1] = 'doubts' and (storage.foldername(name))[2] = auth.uid()::text));
create policy "media staff update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_staff(auth.uid()));
create policy "media staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_staff(auth.uid()));