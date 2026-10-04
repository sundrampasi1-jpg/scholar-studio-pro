create table public.reels (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  video_url text not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.reels to authenticated;
grant insert, update, delete on public.reels to authenticated;
grant all on public.reels to service_role;
alter table public.reels enable row level security;
create policy "reels read" on public.reels for select to authenticated using (is_published or public.has_role(auth.uid(),'admin'));
create policy "reels admin write" on public.reels for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.reel_likes (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);
grant select, insert, delete on public.reel_likes to authenticated;
grant all on public.reel_likes to service_role;
alter table public.reel_likes enable row level security;
create policy "likes read" on public.reel_likes for select to authenticated using (true);
create policy "likes own insert" on public.reel_likes for insert to authenticated with check (user_id = auth.uid());
create policy "likes own delete" on public.reel_likes for delete to authenticated using (user_id = auth.uid());

create table public.reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null,
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.reel_comments to authenticated;
grant all on public.reel_comments to service_role;
alter table public.reel_comments enable row level security;
create policy "comments read" on public.reel_comments for select to authenticated using (true);
create policy "comments own insert" on public.reel_comments for insert to authenticated with check (user_id = auth.uid());
create policy "comments delete own or admin" on public.reel_comments for delete to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));