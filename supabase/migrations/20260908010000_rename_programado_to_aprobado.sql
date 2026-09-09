-- Renombra el status "programado" a "aprobado" (mismo significado, mismo lugar en el
-- pipeline: por_grabar -> en_edicion -> revision -> aprobado -> publicado). No se agrega
-- ningún status nuevo, solo se renombra el valor existente.

begin;

-- 1. Quitar el CHECK constraint viejo ANTES de tocar datos (si migramos datos primero,
--    la primera fila que tome el valor "aprobado" revienta contra la regla vieja).
alter table public.content_pieces
  drop constraint if exists content_pieces_status_check;

-- 2. Migrar los datos existentes.
update public.content_pieces
  set status = 'aprobado'
  where status = 'programado';

-- 3. CHECK constraint nuevo con "aprobado" en vez de "programado".
alter table public.content_pieces
  add constraint content_pieces_status_check
  check (status in ('por_grabar', 'en_edicion', 'revision', 'aprobado', 'publicado'));

commit;

-- Verificación:
-- select status, count(*) from public.content_pieces group by status order by status;
