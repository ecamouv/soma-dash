-- Cierra el acceso anónimo: la anon key es pública (va en cada navegador), así que
-- cualquier policy "to anon" o sin TO (rol public, que incluye anon) dejaba leer y
-- escribir sin iniciar sesión. Todas pasan a "to authenticated". La vista pública
-- /c/[token] ya no usa la anon key: se arma en el servidor con la service role.
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and ('anon' = any(roles) or 'public' = any(roles))
  loop
    execute format('alter policy %I on public.%I to authenticated', p.policyname, p.tablename);
  end loop;
end $$;
