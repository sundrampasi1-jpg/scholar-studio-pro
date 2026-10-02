create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  from_staff boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert on public.support_messages to authenticated;
grant all on public.support_messages to service_role;
alter table public.support_messages enable row level security;
create policy "read own or staff" on public.support_messages for select to authenticated
  using (student_id = auth.uid() or public.is_staff(auth.uid()));
create policy "write own or staff" on public.support_messages for insert to authenticated
  with check (sender_id = auth.uid() and ((student_id = auth.uid() and from_staff = false) or (public.is_staff(auth.uid()) and from_staff = true)));
create index on public.support_messages (student_id, created_at);
alter publication supabase_realtime add table public.support_messages;