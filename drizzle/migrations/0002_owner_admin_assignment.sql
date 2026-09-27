create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), new.email, new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student')
  on conflict do nothing;
  if lower(new.email) = 'sundrampasi1@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;
  return new;
end; $$;

-- Backfill in case the owner account already exists
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role from auth.users u
where lower(u.email) = 'sundrampasi1@gmail.com'
on conflict do nothing;

-- Only the owner may hold the admin role; block any other admin grant at the database level
create or replace function public.guard_admin_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'admin' and not exists (
    select 1 from auth.users u where u.id = new.user_id and lower(u.email) = 'sundrampasi1@gmail.com'
  ) then
    raise exception 'Admin role is reserved for the institute owner';
  end if;
  return new;
end; $$;
create trigger guard_admin_role before insert or update on public.user_roles
  for each row execute function public.guard_admin_role();