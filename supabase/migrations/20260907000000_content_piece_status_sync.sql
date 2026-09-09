-- Mueve la sincronización de status de content_pieces del código de la app a Postgres.
--
-- Contexto del bug: saveEventToSupabase / deleteEventFromSupabase (lib/events.ts) escribían
-- el status de content_pieces directamente en JS, sin verificar el status actual de la pieza.
-- Esto pisaba piezas que ya estaban en una etapa más avanzada (en_edicion/programado) y nunca
-- pasaba por un estado intermedio real al vincular con un evento.
--
-- Vocabulario final (4 estados):
--   no_agendado -> por_grabar  : AUTOMÁTICO, lo maneja el trigger de este script según
--                                 content_pieces.event_id (se liga/desliga desde el calendario).
--   por_grabar  -> en_edicion  : MANUAL, botón en la página de Entregas.
--   en_edicion  -> programado  : MANUAL, botón en la página de Entregas.
--
-- Ejecutar este script completo en el SQL editor de Supabase (Project > SQL Editor).
-- No hay CLI de Supabase ni acceso a la base de datos configurado en este entorno de
-- desarrollo, así que no se pudo aplicar automáticamente.

begin;

-- =========================================================================
-- 1. Quitar el CHECK constraint viejo ANTES de tocar datos.
--
--    La tabla ya tenía un constraint (auto-nombrado "content_pieces_status_check" por
--    Postgres) que solo permitía los 4 valores viejos. Si migramos los datos primero,
--    la primera fila que intente tomar un valor nuevo ("no_agendado") revienta contra
--    esa regla vieja -- eso fue exactamente el error que viste. Por eso el orden aquí
--    es: 1) soltar el constraint viejo, 2) migrar datos, 3) poner el constraint nuevo.
-- =========================================================================
alter table public.content_pieces
  drop constraint if exists content_pieces_status_check;

-- =========================================================================
-- 2. Migrar los valores de status existentes al nuevo vocabulario.
--
--    OJO: el valor de texto "por_grabar" YA EXISTÍA antes con un significado distinto
--    (era el estado por defecto de una pieza sin evento). En el vocabulario nuevo,
--    "por_grabar" pasa a significar "ya tiene evento agendado, falta grabar". Por eso
--    la migración de datos no puede basarse solo en el string viejo: también mira
--    content_pieces.event_id para decidir a cuál de los dos estados nuevos corresponde.
-- =========================================================================
update public.content_pieces
  set status = case
    -- Antes en "por_grabar" y SIN evento ligado -> no hay nada agendado todavía.
    when status = 'por_grabar' and event_id is null then 'no_agendado'
    -- Antes en "por_grabar" y CON evento ligado -> coincide con el nuevo significado.
    when status = 'por_grabar' and event_id is not null then 'por_grabar'
    -- editado y publicado se consolidan en "programado" (etapa manual final desde Entregas).
    when status in ('editado', 'publicado') then 'programado'
    -- en_edicion se queda igual.
    else status
  end
  where status in ('por_grabar', 'editado', 'publicado');

-- Si tu equipo necesita distinguir "programado para publicar" de "ya publicado" como dos
-- estados separados en vez de fusionarlos en "programado", avísame y lo ajustamos a 5 estados.

-- =========================================================================
-- 3. CHECK constraint nuevo: solo se aceptan los 4 valores válidos
-- =========================================================================
-- Si `status` es un enum de Postgres (no texto/varchar) en tu esquema real, comenta el
-- bloque de abajo y avísame: el rename de labels de un enum (ALTER TYPE ... RENAME VALUE)
-- necesita verificar primero qué nombre tiene el tipo actual.

alter table public.content_pieces
  add constraint content_pieces_status_check
  check (status in ('no_agendado', 'por_grabar', 'en_edicion', 'programado'));

alter table public.content_pieces
  alter column status set default 'no_agendado';

-- =========================================================================
-- 4. Trigger: content_pieces.event_id es la única fuente de verdad para la
--    transición automática no_agendado <-> por_grabar.
--
--    INSERT con event_id ya asignado, o UPDATE que cambia event_id de null a un valor:
--      -> status pasa a 'por_grabar' SOLO si status actual es 'no_agendado'.
--    UPDATE que cambia event_id de un valor a null (se quitó del evento, o el evento
--    se borró y el código de la app libera event_id antes del delete):
--      -> status regresa a 'no_agendado' SOLO si status actual es 'por_grabar'.
--
--    Al comparar siempre contra el valor actual de status (no simplemente sobrescribir),
--    el trigger es idempotente: un upsert repetido con el mismo event_id no dispara ningún
--    cambio (OLD.event_id = NEW.event_id), y nunca pisa 'en_edicion' ni 'programado'.
-- =========================================================================
create or replace function public.sync_content_piece_status_on_event_link()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.event_id is not null and NEW.status = 'no_agendado' then
      NEW.status := 'por_grabar';
    end if;
    return NEW;
  end if;

  -- TG_OP = 'UPDATE'
  if NEW.event_id is distinct from OLD.event_id then
    if NEW.event_id is not null and OLD.event_id is null and NEW.status = 'no_agendado' then
      NEW.status := 'por_grabar';
    elsif NEW.event_id is null and OLD.event_id is not null and NEW.status = 'por_grabar' then
      NEW.status := 'no_agendado';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_content_piece_status on public.content_pieces;

create trigger trg_sync_content_piece_status
before insert or update on public.content_pieces
for each row
execute function public.sync_content_piece_status_on_event_link();

commit;

-- =========================================================================
-- Verificación rápida después de correr esto:
-- =========================================================================
-- select status, count(*) from public.content_pieces group by status;
--
-- select * from pg_policies where tablename = 'content_pieces';
--   (confirmar que el rol que usa la app -- normalmente "authenticated" via anon key --
--   tiene una policy de UPDATE sobre content_pieces; si no la tiene, el trigger nunca
--   llega a ejecutarse porque el UPDATE original es rechazado antes.)
