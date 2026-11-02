-- Paquetes editables desde la página Paquetes (antes estaban fijos en lib/packages.ts).
--   packages : catálogo de paquetes con sus cuotas. Lo leen todos los usuarios con sesión;
--              solo admin, dev y operaciones lo modifican (can_manage_billing).
-- El precio NO va aquí: sigue en package_prices, que solo ven esos tres roles.
--
-- CAMBIO EN clients (autorizado por Enrique): el CHECK clients_package_check, que solo aceptaba
-- cinco valores fijos, se reemplaza por una llave foránea a packages(value). No toca datos de
-- clients: los valores existentes ('1', '2', '3', '6_videos', 'solamente_pauta' o null) quedan
-- sembrados abajo antes de crear la llave.

create table if not exists public.packages (
  value text primary key check (value ~ '^[a-z0-9_]+$'),
  label text not null check (length(btrim(label)) > 0),
  reels integer not null default 0 check (reels >= 0),
  fotos integer not null default 0 check (fotos >= 0),
  carruseles integer not null default 0 check (carruseles >= 0),
  -- Posts de pauta por semana; valor inicial de Publicaciones al asignarlo a un cliente sin ajuste propio.
  pauta_posts_per_week integer not null default 0 check (pauta_posts_per_week >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.packages (value, label, reels, fotos, carruseles, pauta_posts_per_week, sort_order) values
  ('1',               'Paquete #1',       4, 4, 0, 0, 1),
  ('2',               'Paquete #2',       7, 6, 1, 0, 2),
  ('3',               'Paquete #3',      10, 8, 2, 0, 3),
  ('6_videos',        'Paquete 6 Videos', 6, 0, 0, 0, 4),
  ('solamente_pauta', 'Solamente Pauta',  0, 0, 0, 0, 5)
on conflict (value) do nothing;

alter table public.packages enable row level security;

drop policy if exists "Leer paquetes" on public.packages;
create policy "Leer paquetes" on public.packages
  for select to authenticated using (true);

drop policy if exists "Gestionar paquetes" on public.packages;
create policy "Gestionar paquetes" on public.packages
  for all to authenticated using (public.can_manage_billing()) with check (public.can_manage_billing());

revoke all on public.packages from anon;
grant select, insert, update, delete on public.packages to authenticated;

-- clients.package: de CHECK fijo a llave foránea. on delete restrict: no se puede borrar un paquete en uso.
alter table public.clients drop constraint if exists clients_package_check;
alter table public.clients drop constraint if exists clients_package_fkey;
alter table public.clients
  add constraint clients_package_fkey
  foreign key (package) references public.packages(value)
  on update cascade on delete restrict;
