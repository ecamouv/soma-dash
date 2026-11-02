-- Sector de mercado de cada referencia (restaurante, ropa, creativo, etc.).
-- Texto libre sin restricción: la lista de sectores vive en la app y puede crecer.
alter table public.inspiration
  add column if not exists sector text;

create index if not exists inspiration_sector_idx on public.inspiration (sector);
