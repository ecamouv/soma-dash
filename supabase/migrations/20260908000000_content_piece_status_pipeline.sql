-- Amplía el pipeline de status de content_pieces a 5 etapas y elimina la sincronización
-- automática con el calendario (ya no aplica: "no_agendado" desaparece).
--
-- Vocabulario final (5 estados, todos manuales salvo el default):
--   por_grabar   : default de toda pieza nueva, con o sin evento agendado en el calendario.
--   en_edicion   : manual, botón en Entregas.
--   revision     : manual, botón en Entregas (nueva etapa, "mandado a revisión").
--   programado   : manual, botón en Entregas.
--   publicado    : manual, checkbox en Publicaciones (vista mensual).
--
-- El trigger trg_sync_content_piece_status (creado en la migración anterior para
-- sincronizar no_agendado <-> por_grabar según content_pieces.event_id) ya no tiene
-- sentido porque "no_agendado" deja de existir como estado separado: agendar o no un
-- evento de grabación ya no cambia el status de producción. Se elimina junto con su
-- función.

begin;

-- 1. Quitar el trigger y la función viejos (automatización basada en event_id).
drop trigger if exists trg_sync_content_piece_status on public.content_pieces;
drop function if exists public.sync_content_piece_status_on_event_link();

-- 2. Quitar el CHECK constraint viejo ANTES de tocar datos (mismo motivo que la vez
--    pasada: si migramos datos primero, la primera fila que tome un valor nuevo
--    revienta contra la regla vieja).
alter table public.content_pieces
  drop constraint if exists content_pieces_status_check;

-- 3. Migrar datos: "no_agendado" se fusiona en "por_grabar" (ambos significan
--    "todavía no se ha grabado"; la distinción de si ya tiene evento agendado deja
--    de reflejarse en el status). Las demás etapas no cambian de nombre.
update public.content_pieces
  set status = 'por_grabar'
  where status = 'no_agendado';

-- 4. CHECK constraint nuevo con las 5 etapas válidas.
alter table public.content_pieces
  add constraint content_pieces_status_check
  check (status in ('por_grabar', 'en_edicion', 'revision', 'programado', 'publicado'));

-- 5. Default de la columna: toda pieza nueva nace "por_grabar".
alter table public.content_pieces
  alter column status set default 'por_grabar';

commit;

-- =========================================================================
-- Verificación rápida después de correr esto:
-- =========================================================================
-- select status, count(*) from public.content_pieces group by status order by status;
-- select tgname from pg_trigger where tgrelid = 'public.content_pieces'::regclass and not tgisinternal;
--   (debe devolver 0 filas -- ya no queda ningún trigger de sincronización automática)
