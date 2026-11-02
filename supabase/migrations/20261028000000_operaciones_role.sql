-- Rol "operaciones" (ve revisiones y fechas programadas; sin tiempos de grabación/edición).
-- Solo toca public.profiles: reemplaza el CHECK de role para aceptar 'operaciones'.
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
  add constraint profiles_role_check
  check (role in ('prod', 'admin', 'community', 'editor', 'dev', 'operaciones'));
