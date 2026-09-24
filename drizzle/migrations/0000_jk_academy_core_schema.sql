-- ROLES
create type public.app_role as enum ('admin','teacher','student');

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','teacher'))
$$;

create policy "profiles select own or staff" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "profiles insert own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles update own or admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "roles select own or staff" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "roles admin all" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- new user trigger: profile + default student role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email, new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student')
  on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- BRANDING / SETTINGS (white-label)
create table public.app_settings (
  id boolean primary key default true,
  app_name text not null default 'JK Academy',
  institute_name text not null default 'JK Academy',
  tagline text not null default 'Crack your exam with confident preparation',
  logo_url text,
  favicon_url text,
  primary_color text not null default '0 72% 45%',
  secondary_color text not null default '0 0% 15%',
  contact_email text default 'support@jkacademy.in',
  contact_phone text default '+91 90000 00000',
  support_info text default 'Support available 9 AM - 8 PM IST',
  address text,
  about text default 'JK Academy helps students prepare for competitive exams with structured courses, live classes and tests.',
  hero_title text default 'Learn smarter. Score higher.',
  hero_subtitle text default 'Live classes, structured courses, tests and doubt support in one app.',
  social_facebook text, social_instagram text, social_youtube text, social_telegram text, social_twitter text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);
grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;
grant update, insert on public.app_settings to authenticated;
alter table public.app_settings enable row level security;
create policy "settings public read" on public.app_settings for select to anon, authenticated using (true);
create policy "settings admin write" on public.app_settings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.app_settings (id) values (true);

-- COURSE STRUCTURE
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  thumbnail_url text,
  price numeric(10,2) not null default 0,
  is_free boolean not null default true,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  start_date date, end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  position int not null default 0
);
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  position int not null default 0
);
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  title text not null,
  description text default '',
  video_url text,
  pdf_url text,
  duration_minutes int default 0,
  position int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  completed boolean not null default false,
  last_viewed_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- TESTS
create table public.tests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  description text default '',
  duration_minutes int not null default 30,
  total_marks int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  question_text text not null,
  option_a text not null, option_b text not null, option_c text, option_d text,
  correct_option text not null default 'a',
  marks int not null default 1,
  solution text,
  position int not null default 0
);
create table public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  test_id uuid not null references public.tests(id) on delete cascade,
  score int not null default 0,
  total int not null default 0,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

-- LIVE CLASSES
create table public.live_classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  title text not null,
  description text default '',
  teacher_name text,
  teacher_id uuid,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 60,
  join_url text,
  recording_url text,
  created_at timestamptz not null default now()
);

-- NOTES / PDFS
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  file_url text not null,
  allow_download boolean not null default true,
  created_at timestamptz not null default now()
);

-- DOUBTS
create table public.doubts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid references public.courses(id) on delete set null,
  subject text,
  title text not null,
  body text not null default '',
  image_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create table public.doubt_replies (
  id uuid primary key default gen_random_uuid(),
  doubt_id uuid not null references public.doubts(id) on delete cascade,
  user_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- NOTIFICATIONS / ANNOUNCEMENTS
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  course_id uuid references public.courses(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  body text default '',
  type text not null default 'general',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- PAYMENTS
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent int not null default 0,
  max_uses int not null default 0,
  used_count int not null default 0,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid references public.courses(id) on delete set null,
  amount numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  coupon_code text,
  status text not null default 'pending',
  provider text not null default 'none',
  provider_ref text,
  created_at timestamptz not null default now()
);

-- GRANTS
grant select, insert, update, delete on
  public.courses, public.batches, public.subjects, public.chapters, public.lessons,
  public.enrollments, public.lesson_progress, public.tests, public.questions,
  public.test_attempts, public.live_classes, public.notes, public.doubts,
  public.doubt_replies, public.announcements, public.notifications,
  public.coupons, public.payments
  to authenticated;
grant select on public.courses, public.batches, public.subjects, public.chapters, public.lessons, public.announcements to anon;
grant all on
  public.courses, public.batches, public.subjects, public.chapters, public.lessons,
  public.enrollments, public.lesson_progress, public.tests, public.questions,
  public.test_attempts, public.live_classes, public.notes, public.doubts,
  public.doubt_replies, public.announcements, public.notifications,
  public.coupons, public.payments
  to service_role;

alter table public.courses enable row level security;
alter table public.batches enable row level security;
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.live_classes enable row level security;
alter table public.notes enable row level security;
alter table public.doubts enable row level security;
alter table public.doubt_replies enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.coupons enable row level security;
alter table public.payments enable row level security;

-- catalogue: public read, staff write
create policy "courses read" on public.courses for select to anon, authenticated using (is_published or public.is_staff(auth.uid()));
create policy "courses staff write" on public.courses for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "batches read" on public.batches for select to anon, authenticated using (true);
create policy "batches staff write" on public.batches for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "subjects read" on public.subjects for select to anon, authenticated using (true);
create policy "subjects staff write" on public.subjects for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "chapters read" on public.chapters for select to anon, authenticated using (true);
create policy "chapters staff write" on public.chapters for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "lessons read" on public.lessons for select to anon, authenticated using (is_published or public.is_staff(auth.uid()));
create policy "lessons staff write" on public.lessons for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "announcements read" on public.announcements for select to anon, authenticated using (true);
create policy "announcements staff write" on public.announcements for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "tests read" on public.tests for select to authenticated using (is_published or public.is_staff(auth.uid()));
create policy "tests staff write" on public.tests for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "questions read" on public.questions for select to authenticated using (true);
create policy "questions staff write" on public.questions for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "notes read" on public.notes for select to authenticated using (true);
create policy "notes staff write" on public.notes for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "live read" on public.live_classes for select to authenticated using (true);
create policy "live staff write" on public.live_classes for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "coupons read" on public.coupons for select to authenticated using (true);
create policy "coupons admin write" on public.coupons for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- user-owned
create policy "enroll read own or staff" on public.enrollments for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "enroll insert own" on public.enrollments for insert to authenticated with check (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "enroll staff manage" on public.enrollments for update to authenticated using (public.is_staff(auth.uid()));
create policy "enroll staff delete" on public.enrollments for delete to authenticated using (public.is_staff(auth.uid()) or user_id = auth.uid());

create policy "progress own" on public.lesson_progress for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "progress insert own" on public.lesson_progress for insert to authenticated with check (user_id = auth.uid());
create policy "progress update own" on public.lesson_progress for update to authenticated using (user_id = auth.uid());

create policy "attempts read own or staff" on public.test_attempts for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "attempts insert own" on public.test_attempts for insert to authenticated with check (user_id = auth.uid());

create policy "doubts read own or staff" on public.doubts for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "doubts insert own" on public.doubts for insert to authenticated with check (user_id = auth.uid());
create policy "doubts update own or staff" on public.doubts for update to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "doubts delete staff" on public.doubts for delete to authenticated using (public.is_staff(auth.uid()));

create policy "replies read" on public.doubt_replies for select to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.doubts d where d.id = doubt_id and d.user_id = auth.uid()));
create policy "replies insert" on public.doubt_replies for insert to authenticated with check (user_id = auth.uid());

create policy "notif read own or staff" on public.notifications for select to authenticated using (user_id = auth.uid() or user_id is null or public.is_staff(auth.uid()));
create policy "notif staff insert" on public.notifications for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "notif update own" on public.notifications for update to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "payments read own or staff" on public.payments for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "payments insert own" on public.payments for insert to authenticated with check (user_id = auth.uid());
create policy "payments staff update" on public.payments for update to authenticated using (public.is_staff(auth.uid()));