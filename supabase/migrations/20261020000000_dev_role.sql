-- Rol "dev" (vista total; desde el sidebar puede ver la interfaz como otro rol).
-- Si profiles.role tiene un CHECK, se reemplaza para aceptar 'dev'.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check check (role in ('prod', 'admin', 'community', 'editor', 'dev'));

update public.profiles set role = 'dev' where lower(email) = 'dev@somamedia.com.mx';
