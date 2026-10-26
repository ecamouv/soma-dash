-- Publicaciones: posts de clientes con paquete "Solamente Pauta".
-- A estos clientes no se les produce contenido: solo se calendariza lo que se publica.
-- Dos tablas nuevas e independientes. NO modifican clients ni content_pieces
-- (client_id solo las referencia con una llave foránea).

-- Cuántos posts por semana tiene asignados cada cliente de pauta.
create table if not exists public.pauta_settings (
  client_id uuid primary key references public.clients(id) on delete cascade,
  posts_per_week integer not null default 0 check (posts_per_week >= 0),
  updated_at timestamptz not null default now()
);

-- Un post por (cliente, mes, semana del mes, número dentro de la semana).
-- week: 1..n según las filas lunes-domingo del calendario mensual.
create table if not exists public.pauta_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  week integer not null check (week >= 1),
  slot integer not null check (slot >= 1),
  name text not null,
  scheduled_date date,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, year, month, week, slot)
);

create index if not exists pauta_posts_month_idx on public.pauta_posts (year, month);

drop trigger if exists pauta_settings_set_updated_at on public.pauta_settings;
create trigger pauta_settings_set_updated_at
  before update on public.pauta_settings
  for each row execute function public.set_updated_at();

drop trigger if exists pauta_posts_set_updated_at on public.pauta_posts;
create trigger pauta_posts_set_updated_at
  before update on public.pauta_posts
  for each row execute function public.set_updated_at();

alter table public.pauta_settings enable row level security;
alter table public.pauta_posts enable row level security;

drop policy if exists "Permitir todo en pauta_settings" on public.pauta_settings;
create policy "Permitir todo en pauta_settings"
  on public.pauta_settings for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "Permitir todo en pauta_posts" on public.pauta_posts;
create policy "Permitir todo en pauta_posts"
  on public.pauta_posts for all to anon, authenticated
  using (true) with check (true);
