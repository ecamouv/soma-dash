-- event_members tenía RLS activado pero SIN ninguna policy (ni de lectura ni de
-- escritura), así que cualquier insert/select sobre esta tabla era rechazado en
-- silencio. Mismo patrón de bug que ya se encontró y corrigió en "clients".
-- Se agregan policies equivalentes a las de events/content_pieces.

drop policy if exists "Permitir todo en event_members" on public.event_members;

create policy "Permitir todo en event_members"
  on public.event_members
  for all
  to anon, authenticated
  using (true)
  with check (true);
