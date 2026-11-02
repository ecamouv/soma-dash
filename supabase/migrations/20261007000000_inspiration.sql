-- Inspiración: links de referencia (YouTube, TikTok, Instagram) con miniatura.
-- Tabla nueva e independiente. NO modifica clients ni content_pieces
-- (client_id solo la referencia con una llave foránea opcional).

create table if not exists public.inspiration (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  platform text not null default 'otro'
    check (platform in ('youtube', 'tiktok', 'instagram', 'otro')),
  title text,
  -- Se llena al guardar: YouTube por la URL de la miniatura, TikTok por oEmbed.
  -- Instagram u otros: queda vacío o se pega a mano.
  thumbnail_url text,
  client_id uuid references public.clients(id) on delete set null,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inspiration_created_idx on public.inspiration (created_at desc);
create index if not exists inspiration_client_idx on public.inspiration (client_id);

alter table public.inspiration enable row level security;

-- Solo usuarios con sesión (a diferencia de otras tablas, sin acceso anónimo).
drop policy if exists "Permitir todo en inspiration" on public.inspiration;
create policy "Permitir todo en inspiration"
  on public.inspiration for all to authenticated
  using (true) with check (true);
