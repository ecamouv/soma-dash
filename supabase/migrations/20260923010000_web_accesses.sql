-- Accesos Web: biblioteca de páginas y recursos del equipo, organizada por sección.
-- IMPORTANTE: no guarda contraseñas. password_note solo indica DÓNDE consultarla
-- (ej. "Notion"). Tabla nueva e independiente: no toca clients ni content_pieces.

create table if not exists public.web_accesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  section text not null default 'General',
  email text,
  password_note text,
  notes text,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_accesses_section_idx on public.web_accesses (section);

drop trigger if exists web_accesses_set_updated_at on public.web_accesses;
create trigger web_accesses_set_updated_at
  before update on public.web_accesses
  for each row execute function public.set_updated_at();

alter table public.web_accesses enable row level security;

drop policy if exists "Permitir todo en web_accesses" on public.web_accesses;
create policy "Permitir todo en web_accesses"
  on public.web_accesses for all to anon, authenticated
  using (true) with check (true);
