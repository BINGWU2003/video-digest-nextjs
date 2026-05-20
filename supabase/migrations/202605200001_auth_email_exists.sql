create or replace function public.auth_email_exists(_email text)
returns boolean
language sql
security definer
set search_path = auth, public
as $$
  select exists (
    select 1
    from auth.users
    where lower(auth.users.email) = lower(_email)
  );
$$;

revoke all on function public.auth_email_exists(text) from public;
grant execute on function public.auth_email_exists(text) to service_role;
