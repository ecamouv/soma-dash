-- La tabla clients tenía RLS activado pero solo con policies de SELECT
-- ("Permitir lectura de clientes a usuarios autenticados" / "...pública de clientes").
-- Nunca se agregó una policy de escritura, así que cualquier INSERT (crear cliente
-- desde la página Soma) era rechazado con 42501 "new row violates row-level security
-- policy". Se agrega una policy de escritura equivalente a la que ya existe en
-- events ("Permitir crear y editar eventos") y content_pieces ("Permitir todo").

drop policy if exists "Permitir crear y editar clientes" on public.clients;

create policy "Permitir crear y editar clientes"
  on public.clients
  for all
  to anon, authenticated
  using (true)
  with check (true);
